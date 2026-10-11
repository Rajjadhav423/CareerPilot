package com.careerpilot.backend.auth;

import java.util.List;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Clerk puts the origin that requested the token in "azp". Rejecting unknown origins stops a token
 * issued to some other site on the same Clerk instance from being replayed against our API.
 */
final class AuthorizedPartyValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error NOT_ALLOWED =
            new OAuth2Error("invalid_token", "The token was issued for an origin that is not allowed", null);

    private final List<String> allowedParties;

    AuthorizedPartyValidator(List<String> allowedParties) {
        this.allowedParties = List.copyOf(allowedParties);
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String azp = token.getClaimAsString("azp");
        // Tokens created outside a browser (e.g. Clerk's backend API) have no azp.
        if (azp == null || allowedParties.contains(azp)) {
            return OAuth2TokenValidatorResult.success();
        }
        return OAuth2TokenValidatorResult.failure(NOT_ALLOWED);
    }
}
