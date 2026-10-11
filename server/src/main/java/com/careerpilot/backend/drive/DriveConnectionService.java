package com.careerpilot.backend.drive;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.drive.DriveDtos.ConnectResponse;
import com.careerpilot.backend.drive.DriveDtos.DriveFolder;
import com.careerpilot.backend.drive.DriveDtos.DriveStatus;
import com.careerpilot.backend.drive.GoogleDriveClient.DriveFile;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccount;
import com.careerpilot.backend.user.User;

/**
 * Google Drive on/off and the CareerPilot folder.
 *
 * The Google permission ({@code drive.file}) is granted through Clerk, like Gmail's: the browser asks Clerk to
 * re-authorize Google with the extra scope, and Clerk stores and refreshes the token. "Disconnect" switches
 * Drive off in CareerPilot and forgets the folder and document list; Google's permission stays on the account
 * (Google can only revoke the whole grant, which would also stop Gmail sending and Google sign-in).
 */
@Service
public class DriveConnectionService {

    static final String APP_KEY = "careerpilot";
    static final String FOLDER_MARKER = "folder";
    static final String DEFAULT_FOLDER_NAME = "CareerPilot";

    private final DriveAccess access;
    private final GoogleDriveClient drive;
    private final DriveSettingsRepository settings;
    private final DriveDocumentRepository documents;
    private final TransactionTemplate transaction;

    public DriveConnectionService(DriveAccess access, GoogleDriveClient drive, DriveSettingsRepository settings,
            DriveDocumentRepository documents, TransactionTemplate transaction) {
        this.access = access;
        this.drive = drive;
        this.settings = settings;
        this.documents = documents;
        this.transaction = transaction;
    }

    public boolean isConfigured() {
        return access.isConfigured();
    }

    public DriveStatus status(User user) {
        if (!isConfigured()) {
            return new DriveStatus(false, false, false, null, null, null);
        }
        GoogleAccount account = access.account(user).orElse(null);
        boolean granted = account != null && account.hasScope(ClerkGoogleAccounts.DRIVE_FILE_SCOPE);
        DriveSettings current = access.settingsFor(user, account);
        boolean connected = granted && current.isEnabled();
        return new DriveStatus(true, connected, granted, account == null ? null : account.email(),
                connected ? current.getFolderId() : null, connected ? current.getFolderName() : null);
    }

    /**
     * Switches Drive on. Tells the browser whether Google still has to grant {@code drive.file} (then the
     * browser re-authorizes Google through Clerk) or whether the permission is already there.
     */
    public ConnectResponse connect(User user) {
        requireConfigured();
        GoogleAccount account = access.account(user).orElse(null);
        DriveSettings current = access.settingsFor(user, account);
        transaction.executeWithoutResult(status -> {
            current.setEnabled(true);
            settings.save(current);
        });
        boolean granted = account != null && account.hasScope(ClerkGoogleAccounts.DRIVE_FILE_SCOPE);
        return new ConnectResponse(!granted, ClerkGoogleAccounts.DRIVE_FILE_SCOPE);
    }

    /** Switches Drive off and forgets our folder choice and document list. Files in Drive are not touched. */
    public void disconnect(User user) {
        transaction.executeWithoutResult(status -> {
            DriveSettings current = settings.findById(user.getId()).orElseGet(() -> new DriveSettings(user.getId()));
            current.setEnabled(false);
            current.selectFolder(null, null);
            settings.save(current);
            documents.deleteAllOwnedBy(user.getId());
        });
    }

    public List<DriveFolder> folders(User user) {
        String selected = settings.findById(user.getId()).map(DriveSettings::getFolderId).orElse(null);
        List<DriveFile> folders = access.withToken(user, token -> drive.list(token,
                "mimeType = '" + GoogleDriveClient.FOLDER_MIME_TYPE + "' and trashed = false and appProperties has { key='"
                        + APP_KEY + "' and value='" + FOLDER_MARKER + "' }", 3));
        return folders.stream().map(f -> new DriveFolder(f.id(), f.name(), f.id().equals(selected))).toList();
    }

    public DriveFolder createFolder(User user, String name) {
        String cleaned = cleanName(name, 100);
        DriveFile folder = access.withToken(user,
                token -> drive.createFolder(token, cleaned, Map.of(APP_KEY, FOLDER_MARKER)));
        saveFolder(user, folder);
        return new DriveFolder(folder.id(), folder.name(), true);
    }

    public DriveFolder selectFolder(User user, String folderId) {
        DriveFile folder = appFolder(user, folderId);
        saveFolder(user, folder);
        return new DriveFolder(folder.id(), folder.name(), true);
    }

    /**
     * The folder new documents go into: the requested one (must be a CareerPilot folder), else the selected
     * one, else a new "CareerPilot" folder created on first use.
     */
    DriveFile resolveUploadFolder(User user, String requestedFolderId) {
        if (requestedFolderId != null && !requestedFolderId.isBlank()) {
            return appFolder(user, requestedFolderId);
        }
        String selected = settings.findById(user.getId()).map(DriveSettings::getFolderId).orElse(null);
        if (selected != null) {
            try {
                return appFolder(user, selected);
            } catch (ApiException e) {
                if (!"DRIVE_FOLDER_NOT_FOUND".equals(e.code())) {
                    throw e;
                }
                // The selected folder was deleted in Drive: fall back to a fresh default folder.
            }
        }
        DriveFile folder = access.withToken(user,
                token -> drive.createFolder(token, DEFAULT_FOLDER_NAME, Map.of(APP_KEY, FOLDER_MARKER)));
        saveFolder(user, folder);
        return folder;
    }

    private DriveFile appFolder(User user, String folderId) {
        DriveFile folder;
        try {
            folder = access.withToken(user, token -> drive.get(token, folderId));
        } catch (ApiException e) {
            if ("DRIVE_DOCUMENT_NOT_FOUND".equals(e.code())) {
                throw DriveErrors.folderNotFound();
            }
            throw e;
        }
        if (folder == null || folder.isTrashed() || !GoogleDriveClient.FOLDER_MIME_TYPE.equals(folder.mimeType())
                || !FOLDER_MARKER.equals(folder.appProperty(APP_KEY))) {
            throw DriveErrors.folderNotFound();
        }
        return folder;
    }

    private void saveFolder(User user, DriveFile folder) {
        transaction.executeWithoutResult(status -> {
            DriveSettings current = settings.findById(user.getId()).orElseGet(() -> new DriveSettings(user.getId()));
            current.selectFolder(folder.id(), folder.name());
            settings.save(current);
        });
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw DriveErrors.notConfigured();
        }
    }

    static String cleanName(String value, int max) {
        String cleaned = value == null ? "" : value.replaceAll("[\\p{Cntrl}\\\\/]", " ").replaceAll("\\s+", " ").strip();
        if (cleaned.length() > max) {
            cleaned = cleaned.substring(0, max).strip();
        }
        return cleaned.isEmpty() ? DEFAULT_FOLDER_NAME : cleaned;
    }
}
