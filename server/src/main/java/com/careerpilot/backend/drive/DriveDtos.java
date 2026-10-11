package com.careerpilot.backend.drive;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class DriveDtos {

    private DriveDtos() {
    }

    /**
     * Never contains tokens.
     *
     * @param configured        the server can reach Clerk (Drive is available at all)
     * @param connected         Drive can be used now: permission granted and switched on in CareerPilot
     * @param permissionGranted the Google account granted drive.file (through Clerk)
     */
    public record DriveStatus(boolean configured, boolean connected, boolean permissionGranted, String googleEmail,
            String folderId, String folderName) {
    }

    /** {@code needsGoogleConsent}: the browser must re-authorize Google through Clerk with {@code scope}. */
    public record ConnectResponse(boolean needsGoogleConsent, String scope) {
    }

    public record DriveFolder(String id, String name, boolean selected) {
    }

    public record CreateFolderRequest(@NotBlank(message = "is required") @Size(max = 100) String name) {
    }

    public record SelectFolderRequest(
            @NotBlank(message = "is required") @Pattern(regexp = "[A-Za-z0-9_-]{1,128}", message = "is not a folder id")
            String folderId) {
    }

    public record RenameRequest(@NotBlank(message = "is required") @Size(max = 150) String name) {
    }

    public record DriveDocumentResponse(UUID id, String name, String mimeType, Long sizeBytes, String webViewLink,
            String folderId, UUID resumeId, Instant createdAt, Instant updatedAt) {

        static DriveDocumentResponse of(DriveDocument document) {
            return new DriveDocumentResponse(document.getId(), document.getName(), document.getMimeType(),
                    document.getSizeBytes(), document.getWebViewLink(), document.getFolderId(), document.getResumeId(),
                    document.getCreatedAt(), document.getUpdatedAt());
        }
    }

    /** A downloaded file. */
    public record DriveFileContent(String name, String mimeType, byte[] content) {
    }
}
