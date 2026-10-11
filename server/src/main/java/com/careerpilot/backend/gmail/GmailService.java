package com.careerpilot.backend.gmail;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccessToken;
import com.careerpilot.backend.gmail.GmailApiClient.SentMessage;
import com.careerpilot.backend.user.User;

/**
 * Gmail for the signed-in user only: the Clerk user id always comes from their verified session token,
 * so nobody can use another person's connected account.
 */
@Service
public class GmailService {

    /**
     * @param configured  the server has a Clerk secret key
     * @param connected   the user has a Google account linked in Clerk
     * @param canSend     that Google account granted the gmail.send permission
     * @param googleEmail the Gmail address emails will be sent from (no token data)
     */
    public record GmailStatus(boolean configured, boolean connected, boolean canSend, String googleEmail) {
    }

    private final ClerkGoogleAccounts googleAccounts;
    private final GmailApiClient gmail;

    public GmailService(ClerkGoogleAccounts googleAccounts, GmailApiClient gmail) {
        this.googleAccounts = googleAccounts;
        this.gmail = gmail;
    }

    public GmailStatus status(User user) {
        if (!googleAccounts.isConfigured()) {
            return new GmailStatus(false, false, false, null);
        }
        return googleAccounts.findGoogleAccount(user.getClerkUserId())
                .map(account -> new GmailStatus(true, true, account.canSendGmail(), account.email()))
                .orElseGet(() -> new GmailStatus(true, false, false, null));
    }

    /** Sends from the user's own Gmail. Returns only after Gmail confirms it accepted the message. */
    public SentMessage send(User user, String to, String subject, String body) {
        if (!googleAccounts.isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GMAIL_NOT_CONFIGURED",
                    "Gmail isn't set up on this server yet.");
        }
        GoogleAccessToken token = googleAccounts.findAccessToken(user.getClerkUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "GMAIL_NOT_CONNECTED",
                        "Connect your Gmail account to send emails."));
        if (!token.canSendGmail()) {
            throw new ApiException(HttpStatus.CONFLICT, "GMAIL_PERMISSION_MISSING",
                    "Your Google connection doesn't allow sending email yet. Reconnect Gmail and allow sending.");
        }
        return gmail.send(token, MimeMessageBuilder.build(to, subject, body));
    }
}
