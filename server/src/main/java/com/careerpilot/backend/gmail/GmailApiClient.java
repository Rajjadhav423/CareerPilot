package com.careerpilot.backend.gmail;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import com.careerpilot.backend.common.ApiException;

/** Sends a prepared message through the Gmail API as the signed-in user. */
@Component
public class GmailApiClient {

    private static final Logger log = LoggerFactory.getLogger(GmailApiClient.class);

    /** Gmail's confirmation that it accepted the message. */
    public record SentMessage(String messageId, String threadId) {
    }

    private record GmailSendResponse(String id, String threadId) {
    }

    private final RestClient restClient;

    public GmailApiClient(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("https://gmail.googleapis.com").build();
    }

    /**
     * @param rfc5322Message the full message from {@link MimeMessageBuilder}
     * @throws ApiException with a user-facing code when Gmail refuses or can't be reached
     */
    public SentMessage send(ClerkGoogleAccounts.GoogleAccessToken token, String rfc5322Message) {
        String raw = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(rfc5322Message.getBytes(StandardCharsets.UTF_8));
        GmailSendResponse response;
        try {
            response = restClient.post()
                    .uri("/gmail/v1/users/me/messages/send")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token.value())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("raw", raw))
                    .retrieve()
                    .body(GmailSendResponse.class);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            // Status only: never log tokens, recipients or message content.
            log.warn("Gmail send failed with status {}", status);
            throw switch (status) {
                case 401 -> new ApiException(HttpStatus.CONFLICT, "GMAIL_AUTH_FAILED",
                        "Your Google connection has expired. Reconnect Gmail and try again.");
                case 403 -> new ApiException(HttpStatus.CONFLICT, "GMAIL_PERMISSION_MISSING",
                        "CareerPilot isn't allowed to send email from your Gmail. Reconnect Gmail and allow sending.");
                case 400 -> new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "GMAIL_REJECTED",
                        "Gmail rejected the message. Check the recipient address and try again.");
                default -> new ApiException(HttpStatus.BAD_GATEWAY, "GMAIL_UNAVAILABLE",
                        "Gmail is unavailable right now. Your email was not sent; please try again shortly.");
            };
        } catch (RestClientException e) {
            log.warn("Gmail unreachable: {}", e.getClass().getSimpleName());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "GMAIL_UNAVAILABLE",
                    "Gmail is unavailable right now. Your email was not sent; please try again shortly.");
        }
        if (response == null || response.id() == null || response.id().isBlank()) {
            log.warn("Gmail send returned no message id");
            throw new ApiException(HttpStatus.BAD_GATEWAY, "GMAIL_UNAVAILABLE",
                    "Gmail didn't confirm the message. Check your Sent folder before trying again.");
        }
        return new SentMessage(response.id(), response.threadId());
    }
}
