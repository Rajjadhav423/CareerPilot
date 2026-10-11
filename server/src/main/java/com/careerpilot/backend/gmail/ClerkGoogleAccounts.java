package com.careerpilot.backend.gmail;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import com.careerpilot.backend.auth.ClerkProperties;
import com.careerpilot.backend.common.ApiException;

/**
 * Reads the user's Google connection from Clerk's Backend API (server side, with the Clerk secret key).
 * Clerk stores and refreshes the Google tokens; we never persist them, log them or send them to the browser.
 */
@Component
public class ClerkGoogleAccounts {

    public static final String GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

    private static final Logger log = LoggerFactory.getLogger(ClerkGoogleAccounts.class);

    /** The user's Google account as Clerk knows it. */
    public record GoogleAccount(String email, Set<String> approvedScopes) {

        public boolean canSendGmail() {
            return approvedScopes.contains(GMAIL_SEND_SCOPE);
        }
    }

    /** A short-lived Google access token. {@link #toString()} is redacted so it can't leak into logs. */
    public record GoogleAccessToken(String value, Set<String> scopes) {

        public boolean canSendGmail() {
            return scopes.contains(GMAIL_SEND_SCOPE);
        }

        @Override
        public String toString() {
            return "GoogleAccessToken[value=<redacted>, scopes=" + scopes + "]";
        }
    }

    private final RestClient restClient;
    private final boolean configured;

    public ClerkGoogleAccounts(RestClient.Builder builder, ClerkProperties clerk) {
        this.configured = clerk.hasSecretKey();
        this.restClient = builder
                .baseUrl("https://api.clerk.com/v1")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + (configured ? clerk.secretKey() : ""))
                .build();
    }

    /** False when CLERK_SECRET_KEY isn't set: Gmail features are then unavailable. */
    public boolean isConfigured() {
        return configured;
    }

    public Optional<GoogleAccount> findGoogleAccount(String clerkUserId) {
        JsonNode user = get("/users/{userId}", clerkUserId);
        if (user == null) {
            return Optional.empty();
        }
        for (JsonNode account : user.path("external_accounts")) {
            String provider = account.path("provider").asString("");
            if (provider.equals("oauth_google") || provider.equals("google")) {
                return Optional.of(new GoogleAccount(
                        account.path("email_address").asString(""),
                        splitScopes(account.path("approved_scopes").asString(""))));
            }
        }
        return Optional.empty();
    }

    /** Clerk refreshes an expired Google token transparently before returning it. */
    public Optional<GoogleAccessToken> findAccessToken(String clerkUserId) {
        JsonNode response = get("/users/{userId}/oauth_access_tokens/oauth_google?paginated=true", clerkUserId);
        if (response == null) {
            return Optional.empty();
        }
        JsonNode tokens = response.isArray() ? response : response.path("data");
        if (!tokens.isArray() || tokens.isEmpty()) {
            return Optional.empty();
        }
        JsonNode first = tokens.get(0);
        String token = first.path("token").asString("");
        if (token.isBlank()) {
            return Optional.empty();
        }
        Set<String> scopes = new LinkedHashSet<>();
        first.path("scopes").forEach(scope -> scopes.add(scope.asString()));
        return Optional.of(new GoogleAccessToken(token, scopes));
    }

    /** @return the JSON body, or null when Clerk says the user/token doesn't exist (404) */
    private JsonNode get(String path, String clerkUserId) {
        if (!configured) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GMAIL_NOT_CONFIGURED",
                    "Gmail isn't set up on this server yet.");
        }
        try {
            return restClient.get().uri(path, clerkUserId).retrieve().body(JsonNode.class);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                return null;
            }
            // Status only: response bodies may contain personal data.
            log.warn("Clerk Backend API call failed with status {}", e.getStatusCode().value());
            throw unavailable();
        } catch (RestClientException e) {
            log.warn("Clerk Backend API unreachable: {}", e.getClass().getSimpleName());
            throw unavailable();
        }
    }

    private static Set<String> splitScopes(String scopes) {
        Set<String> result = new LinkedHashSet<>();
        Arrays.stream(scopes.split("[\\s,]+")).filter(scope -> !scope.isBlank()).forEach(result::add);
        return result;
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "GMAIL_UNAVAILABLE",
                "Couldn't check your Google connection right now. Please try again shortly.");
    }
}
