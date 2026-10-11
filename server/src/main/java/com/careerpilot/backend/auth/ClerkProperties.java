package com.careerpilot.backend.auth;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param issuer            Clerk Frontend API URL, e.g. https://xxxx.clerk.accounts.dev (the token's "iss")
 * @param authorizedParties frontend origins allowed in the token's "azp" claim
 * @param webhookSecret     signing secret of the Clerk webhook endpoint ("whsec_..."); blank = webhooks disabled
 */
@ConfigurationProperties("careerpilot.clerk")
public record ClerkProperties(
        String issuer,
        @DefaultValue("http://localhost:3000") List<String> authorizedParties,
        String webhookSecret) {

    /** Fail at startup, not on the first request, if CLERK_ISSUER is missing or not a URL. */
    public ClerkProperties {
        if (issuer == null || !issuer.startsWith("https://")) {
            throw new IllegalStateException("careerpilot.clerk.issuer must be your Clerk Frontend API URL "
                    + "(https://xxxx.clerk.accounts.dev), but was '" + issuer + "'. Set CLERK_ISSUER in server/.env.");
        }
    }

    /** Clerk publishes its public signing keys here. */
    public String jwksUri() {
        return stripTrailingSlash(issuer) + "/.well-known/jwks.json";
    }

    public String normalisedIssuer() {
        return stripTrailingSlash(issuer);
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
