package com.careerpilot.backend.drive;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.careerpilot.backend.drive.GoogleDriveClient.DriveApiException;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccessToken;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccount;
import com.careerpilot.backend.user.User;

/**
 * Gives Drive calls a Google access token from Clerk (which stores and refreshes it, as for Gmail).
 * CareerPilot never stores Google tokens. Drive is usable when Clerk is configured, the user's Google
 * account granted {@code drive.file}, and the user hasn't switched Drive off in CareerPilot.
 */
@Component
class DriveAccess {

    private final ClerkGoogleAccounts google;
    private final DriveSettingsRepository settings;
    private final DriveDocumentRepository documents;
    private final TransactionTemplate transaction;

    DriveAccess(ClerkGoogleAccounts google, DriveSettingsRepository settings, DriveDocumentRepository documents,
            TransactionTemplate transaction) {
        this.google = google;
        this.settings = settings;
        this.documents = documents;
        this.transaction = transaction;
    }

    boolean isConfigured() {
        return google.isConfigured();
    }

    /** The user's Google account as Clerk reports it, if they have one. */
    Optional<GoogleAccount> account(User user) {
        return google.findGoogleAccount(user.getClerkUserId());
    }

    /** Settings row for the user (created on first use). Clears our document list if the Google account changed. */
    DriveSettings settingsFor(User user, GoogleAccount account) {
        return transaction.execute(status -> {
            DriveSettings current = settings.findById(user.getId()).orElseGet(() -> new DriveSettings(user.getId()));
            String email = account == null ? null : account.email();
            if (email != null && current.getGoogleEmail() != null && !Objects.equals(current.getGoogleEmail(), email)) {
                // Files from the previous Google account stay in that Drive; only our list of them is cleared.
                documents.deleteAllOwnedBy(user.getId());
                current.selectFolder(null, null);
            }
            if (email != null) {
                current.setGoogleEmail(email);
            }
            return settings.save(current);
        });
    }

    /**
     * Runs a Drive call with a fresh token from Clerk. A 401 gets one retry with a newly fetched token
     * (Clerk refreshes expired tokens); a second 401 means access was withdrawn at Google.
     */
    <T> T withToken(User user, Function<String, T> call) {
        requireUsable(user);
        try {
            return call.apply(token(user));
        } catch (DriveApiException e) {
            if (e.status() != 401) {
                throw DriveErrors.from(e);
            }
        }
        try {
            return call.apply(token(user));
        } catch (DriveApiException e) {
            throw e.status() == 401 ? DriveErrors.reconnectRequired() : DriveErrors.from(e);
        }
    }

    void requireUsable(User user) {
        if (!isConfigured()) {
            throw DriveErrors.notConfigured();
        }
        DriveSettings current = settings.findById(user.getId()).orElse(null);
        if (current != null && !current.isEnabled()) {
            throw DriveErrors.notConnected();
        }
    }

    private String token(User user) {
        GoogleAccessToken token = google.findAccessToken(user.getClerkUserId())
                .orElseThrow(DriveErrors::notConnected);
        if (!token.hasScope(ClerkGoogleAccounts.DRIVE_FILE_SCOPE)) {
            throw DriveErrors.permissionMissing();
        }
        return token.value();
    }
}
