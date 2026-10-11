package com.careerpilot.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Uses real RS256-signed tokens (like Clerk's) with a locally generated key, and the same validator
 * the app uses, to prove what the API accepts and rejects.
 */
class ClerkTokenValidationTest {

    private static final String ISSUER = "https://test-instance.clerk.accounts.dev";
    private static final ClerkProperties CLERK = new ClerkProperties(ISSUER + "/", List.of("http://localhost:3000"), null);

    private static KeyPair clerkKeys;
    private static KeyPair attackerKeys;
    private static NimbusJwtDecoder decoder;

    @BeforeAll
    static void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        clerkKeys = generator.generateKeyPair();
        attackerKeys = generator.generateKeyPair();
        decoder = NimbusJwtDecoder.withPublicKey((RSAPublicKey) clerkKeys.getPublic()).build();
        decoder.setJwtValidator(ClerkJwtConfig.clerkTokenValidator(CLERK));
    }

    @Test
    void acceptsValidClerkToken() throws Exception {
        Jwt jwt = decoder.decode(token(clerkKeys, claims().build()));

        assertThat(jwt.getSubject()).isEqualTo("user_123");
        assertThat(jwt.getClaimAsString("email")).isEqualTo("raj@example.com");
    }

    @Test
    void acceptsTokenWithoutAzp() throws Exception {
        assertThat(decoder.decode(token(clerkKeys, claims().claim("azp", null).build())).getSubject())
                .isEqualTo("user_123");
    }

    @Test
    void rejectsTokenFromAnotherIssuer() {
        assertThatThrownBy(() -> decoder.decode(token(clerkKeys, claims().issuer("https://evil.example").build())))
                .isInstanceOf(JwtValidationException.class);
    }

    @Test
    void rejectsTokenForAnotherOrigin() {
        assertThatThrownBy(() -> decoder.decode(token(clerkKeys, claims().claim("azp", "https://evil.example").build())))
                .isInstanceOf(JwtValidationException.class)
                .hasMessageContaining("origin that is not allowed");
    }

    @Test
    void rejectsExpiredToken() {
        Instant past = Instant.now().minusSeconds(600);
        assertThatThrownBy(() -> decoder.decode(token(clerkKeys,
                claims().issueTime(Date.from(past)).expirationTime(Date.from(past.plusSeconds(60))).build())))
                .isInstanceOf(JwtValidationException.class);
    }

    @Test
    void rejectsTokenSignedWithAnotherKey() {
        assertThatThrownBy(() -> decoder.decode(token(attackerKeys, claims().build())))
                .hasMessageContaining("Invalid signature");
    }

    @Test
    void missingOrUnresolvedIssuerFailsFast() {
        assertThatThrownBy(() -> new ClerkProperties("${CLERK_ISSUER}", List.of(), null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Set CLERK_ISSUER");
        assertThatThrownBy(() -> new ClerkProperties(null, List.of(), null)).isInstanceOf(IllegalStateException.class);
    }

    private static JWTClaimsSet.Builder claims() {
        Instant now = Instant.now();
        return new JWTClaimsSet.Builder()
                .subject("user_123")
                .issuer(ISSUER)
                .claim("azp", "http://localhost:3000")
                .claim("email", "raj@example.com")
                .issueTime(Date.from(now))
                .notBeforeTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(60)));
    }

    private static String token(KeyPair keys, JWTClaimsSet claims) throws JOSEException {
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test").build(), claims);
        jwt.sign(new RSASSASigner((RSAPrivateKey) keys.getPrivate()));
        return jwt.serialize();
    }
}
