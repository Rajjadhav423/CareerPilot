package com.careerpilot.backend.drive;

import org.springframework.http.HttpStatus;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.drive.GoogleDriveClient.DriveApiException;

/** Turns Drive failures into clear, safe messages (no Google error text is passed through). */
final class DriveErrors {

    private DriveErrors() {
    }

    static ApiException notConfigured() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DRIVE_NOT_CONFIGURED",
                "Google Drive isn't set up on this server yet.");
    }

    static ApiException notConnected() {
        return new ApiException(HttpStatus.CONFLICT, "DRIVE_NOT_CONNECTED",
                "Connect Google Drive first.");
    }

    static ApiException permissionMissing() {
        return new ApiException(HttpStatus.CONFLICT, "DRIVE_PERMISSION_MISSING",
                "CareerPilot doesn't have permission to save files to your Google Drive yet. Connect Google Drive to allow it.");
    }

    static ApiException reconnectRequired() {
        return new ApiException(HttpStatus.CONFLICT, "DRIVE_RECONNECT_REQUIRED",
                "CareerPilot no longer has access to your Google Drive. Connect Google Drive again to continue.");
    }

    static ApiException documentNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "DRIVE_DOCUMENT_NOT_FOUND",
                "That document wasn't found. It may have been deleted in Google Drive.");
    }

    static ApiException folderNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "DRIVE_FOLDER_NOT_FOUND",
                "That folder wasn't found. Pick or create a CareerPilot folder.");
    }

    static ApiException from(DriveApiException e) {
        return switch (e.status()) {
            case 401 -> reconnectRequired();
            case 403 -> "storageQuotaExceeded".equals(e.reason())
                    ? new ApiException(HttpStatus.CONFLICT, "DRIVE_STORAGE_FULL",
                            "Your Google Drive is full. Free up space and try again.")
                    : "insufficientPermissions".equals(e.reason()) ? permissionMissing()
                    : new ApiException(HttpStatus.CONFLICT, "DRIVE_PERMISSION_DENIED",
                            "Google Drive refused this action. Reconnect Google Drive and try again.");
            case 404 -> documentNotFound();
            case 413 -> new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "DRIVE_FILE_TOO_LARGE",
                    "That file is too large to open here. Open it in Google Drive instead.");
            default -> new ApiException(HttpStatus.BAD_GATEWAY, "DRIVE_UNAVAILABLE",
                    "Google Drive is unavailable right now. Nothing was changed; please try again shortly.");
        };
    }
}
