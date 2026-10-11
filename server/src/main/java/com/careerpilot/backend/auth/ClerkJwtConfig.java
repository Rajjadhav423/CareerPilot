package com.careerpilot.backend.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Verifies Clerk session tokens: signature (Clerk's public keys, fetched on first use and cached),
 * expiry, issuer and authorized party. No Clerk secret is needed on the server.
 */
@Configuration
class ClerkJwtConfig {

    @Bean
    JwtDecoder jwtDecoder(ClerkProperties clerk) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(clerk.jwksUri()).build();
        decoder.setJwtValidator(clerkTokenValidator(clerk));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> clerkTokenValidator(ClerkProperties clerk) {
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(clerk.normalisedIssuer()),
                new AuthorizedPartyValidator(clerk.authorizedParties()));
    }
}
