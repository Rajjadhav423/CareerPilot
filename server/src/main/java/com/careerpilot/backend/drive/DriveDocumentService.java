package com.careerpilot.backend.drive;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.drive.DriveDtos.DriveDocumentResponse;
import com.careerpilot.backend.drive.DriveDtos.DriveFileContent;
import com.careerpilot.backend.drive.GoogleDriveClient.DriveFile;
import com.careerpilot.backend.user.User;

/**
 * Documents CareerPilot keeps in the user's Drive.
 *
 * <ul>
 *   <li>Uploads are idempotent: the client sends a request id; a retry (double click, dropped connection)
 *       returns the first upload instead of creating a second file, even if our database write was lost.</li>
 *   <li>Every action first checks the document belongs to the user (our metadata) and is a CareerPilot file
 *       in Drive (app marker); drive.file means Google enforces the same boundary on its side.</li>
 *   <li>Deleting moves the file to Drive's trash (recoverable for 30 days) and only after explicit
 *       confirmation. Removing our metadata never deletes a Drive file.</li>
 * </ul>
 */
@Service
public class DriveDocumentService {

    static final String DOCUMENT_MARKER = "document";
    static final String REQUEST_KEY = "careerpilotRequest";
    private static final String PDF = "application/pdf";
    private static final long MAX_DOWNLOAD_BYTES = 20L * 1024 * 1024;

    private final DriveConnectionService connectionService;
    private final DriveAccess access;
    private final GoogleDriveClient drive;
    private final DriveDocumentRepository documents;
    private final TransactionTemplate transaction;
    private final Map<String, Object> uploadLocks = new ConcurrentHashMap<>();

    public DriveDocumentService(DriveConnectionService connectionService, DriveAccess access, GoogleDriveClient drive,
            DriveDocumentRepository documents, TransactionTemplate transaction) {
        this.connectionService = connectionService;
        this.access = access;
        this.drive = drive;
        this.documents = documents;
        this.transaction = transaction;
    }

    /**
     * Uploads a PDF into the chosen (or default) CareerPilot folder. A name already used in that folder
     * gets a " (2)", " (3)" … suffix.
     */
    public DriveDocumentResponse uploadPdf(User user, UUID requestId, String fileName, String folderId,
            UUID resumeId, byte[] content) {
        access.requireUsable(user);
        UUID userId = user.getId();
        String lockKey = userId + ":" + requestId;
        Object lock = uploadLocks.computeIfAbsent(lockKey, key -> new Object());
        try {
            synchronized (lock) {
                var existing = documents.findByUserIdAndRequestId(userId, requestId);
                if (existing.isPresent()) {
                    return DriveDocumentResponse.of(existing.get());
                }

                // A previous attempt may have reached Drive before the connection dropped: reuse that file.
                List<DriveFile> earlier = access.withToken(user, token -> drive.list(token,
                        "trashed = false and appProperties has { key='" + REQUEST_KEY + "' and value='" + requestId + "' }", 1));
                DriveFile file;
                if (!earlier.isEmpty()) {
                    file = earlier.getFirst();
                } else {
                    DriveFile folder = connectionService.resolveUploadFolder(user, folderId);
                    Set<String> taken = namesIn(user, folder.id());
                    String name = uniqueName(pdfName(fileName), taken);
                    Map<String, String> marker = Map.of(DriveConnectionService.APP_KEY, DOCUMENT_MARKER,
                            REQUEST_KEY, requestId.toString());
                    file = access.withToken(user,
                            token -> drive.upload(token, name, folder.id(), PDF, marker, content));
                }
                return DriveDocumentResponse.of(record(userId, file, requestId, resumeId));
            }
        } finally {
            uploadLocks.remove(lockKey, lock);
        }
    }

    /** CareerPilot files in the user's Drive, refreshed from Drive (files deleted there disappear here). */
    public List<DriveDocumentResponse> list(User user) {
        access.requireUsable(user);
        UUID userId = user.getId();
        List<DriveFile> files = access.withToken(user, token -> drive.list(token,
                "trashed = false and appProperties has { key='" + DriveConnectionService.APP_KEY + "' and value='"
                        + DOCUMENT_MARKER + "' }", 5));
        Map<String, DriveFile> byId = files.stream()
                .collect(Collectors.toMap(DriveFile::id, f -> f, (a, b) -> a, HashMap::new));
        transaction.executeWithoutResult(status -> {
            for (DriveDocument row : documents.findAllByUserIdOrderByUpdatedAtDesc(userId)) {
                DriveFile file = byId.remove(row.getDriveFileId());
                if (file == null) {
                    documents.delete(row); // gone or trashed in Drive: forget our metadata only
                } else {
                    row.refresh(file.name(), file.firstParent(), mime(file), file.sizeBytes(), file.webViewLink());
                }
            }
            for (DriveFile file : byId.values()) {
                DriveDocument row = new DriveDocument(userId, file.id(), requestIdOf(file), null);
                row.refresh(file.name(), file.firstParent(), mime(file), file.sizeBytes(), file.webViewLink());
                documents.save(row);
            }
        });
        return documents.findAllByUserIdOrderByUpdatedAtDesc(userId).stream().map(DriveDocumentResponse::of).toList();
    }

    public DriveDocumentResponse rename(User user, UUID documentId, String newName) {
        access.requireUsable(user);
        UUID userId = user.getId();
        DriveDocument document = owned(userId, documentId);
        String name = PDF.equals(document.getMimeType()) ? pdfName(newName) : DriveConnectionService.cleanName(newName, 150);
        boolean taken = documents.findAllByUserIdOrderByUpdatedAtDesc(userId).stream()
                .anyMatch(other -> !other.getId().equals(documentId)
                        && java.util.Objects.equals(other.getFolderId(), document.getFolderId())
                        && other.getName().equalsIgnoreCase(name));
        if (taken) {
            throw new ApiException(HttpStatus.CONFLICT, "DRIVE_NAME_TAKEN",
                    "Another document in this folder is already called \"" + name + "\". Choose a different name.");
        }
        DriveFile updated = access.withToken(user,
                token -> drive.update(token, document.getDriveFileId(), Map.of("name", name)));
        return DriveDocumentResponse.of(transaction.execute(status -> {
            DriveDocument row = owned(userId, documentId);
            row.refresh(updated.name(), updated.firstParent(), mime(updated), updated.sizeBytes(), updated.webViewLink());
            return documents.save(row);
        }));
    }

    /** Moves the file to Drive's trash. Requires {@code confirmed}; nothing happens otherwise. */
    public void trash(User user, UUID documentId, boolean confirmed) {
        if (!confirmed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CONFIRMATION_REQUIRED",
                    "Confirm that you want to move this document to your Google Drive trash.");
        }
        access.requireUsable(user);
        UUID userId = user.getId();
        DriveDocument document = owned(userId, documentId);
        try {
            access.withToken(user,
                    token -> drive.update(token, document.getDriveFileId(), Map.of("trashed", true)));
        } catch (ApiException e) {
            if (!"DRIVE_DOCUMENT_NOT_FOUND".equals(e.code())) {
                throw e; // keep our record so the user can retry
            }
            // Already gone from Drive: just forget it.
        }
        transaction.executeWithoutResult(status -> documents.findByIdAndUserId(documentId, userId).ifPresent(documents::delete));
    }

    public DriveFileContent download(User user, UUID documentId) {
        access.requireUsable(user);
        UUID userId = user.getId();
        DriveDocument document = owned(userId, documentId);
        DriveFile file = access.withToken(user, token -> drive.get(token, document.getDriveFileId()));
        if (file == null || file.isTrashed()
                || !DOCUMENT_MARKER.equals(file.appProperty(DriveConnectionService.APP_KEY))) {
            throw DriveErrors.documentNotFound();
        }
        byte[] content = access.withToken(user,
                token -> drive.download(token, document.getDriveFileId(), MAX_DOWNLOAD_BYTES));
        return new DriveFileContent(file.name(), mime(file), content);
    }

    private DriveDocument record(UUID userId, DriveFile file, UUID requestId, UUID resumeId) {
        try {
            return transaction.execute(status -> {
                DriveDocument row = documents.findByUserIdAndDriveFileId(userId, file.id())
                        .orElseGet(() -> new DriveDocument(userId, file.id(), requestId, resumeId));
                row.refresh(file.name(), file.firstParent(), mime(file), file.sizeBytes(), file.webViewLink());
                return documents.saveAndFlush(row);
            });
        } catch (DataIntegrityViolationException e) {
            // A parallel request recorded the same upload first
            return documents.findByUserIdAndRequestId(userId, requestId)
                    .or(() -> documents.findByUserIdAndDriveFileId(userId, file.id()))
                    .orElseThrow(() -> e);
        }
    }

    private Set<String> namesIn(User user, String folderId) {
        List<DriveFile> files = access.withToken(user,
                token -> drive.list(token, "'" + folderId + "' in parents and trashed = false", 5));
        Set<String> names = new HashSet<>();
        files.forEach(f -> names.add(f.name().toLowerCase(Locale.ROOT)));
        return names;
    }

    static String uniqueName(String name, Set<String> takenLowerCase) {
        if (!takenLowerCase.contains(name.toLowerCase(Locale.ROOT))) {
            return name;
        }
        String base = name.endsWith(".pdf") ? name.substring(0, name.length() - 4) : name;
        String extension = name.endsWith(".pdf") ? ".pdf" : "";
        for (int i = 2; i < 1000; i++) {
            String candidate = base + " (" + i + ")" + extension;
            if (!takenLowerCase.contains(candidate.toLowerCase(Locale.ROOT))) {
                return candidate;
            }
        }
        return base + " (" + UUID.randomUUID().toString().substring(0, 8) + ")" + extension;
    }

    /** A safe file name ending in ".pdf" (no path separators or control characters, at most 150 chars). */
    static String pdfName(String value) {
        String cleaned = value == null ? "" : value.replaceAll("(?i)\\.pdf$", "")
                .replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]", " ").replaceAll("\\s+", " ").strip();
        if (cleaned.length() > 146) {
            cleaned = cleaned.substring(0, 146).strip();
        }
        return (cleaned.isEmpty() || cleaned.matches("\\.+") ? "Document" : cleaned) + ".pdf";
    }

    private DriveDocument owned(UUID userId, UUID documentId) {
        return documents.findByIdAndUserId(documentId, userId).orElseThrow(DriveErrors::documentNotFound);
    }

    private static String mime(DriveFile file) {
        return file.mimeType() == null ? PDF : file.mimeType();
    }

    private static UUID requestIdOf(DriveFile file) {
        try {
            String value = file.appProperty(REQUEST_KEY);
            return value == null ? null : UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
