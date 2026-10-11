package com.careerpilot.backend.auth.webhook;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class SvixSignatureVerifierTest {

    private static final String SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
    private static final Instant NOW = Instant.parse("2026-10-11T10:00:00Z");
    private static final String TIMESTAMP = String.valueOf(NOW.getEpochSecond());
    private static final String BODY = "{\"type\":\"user.created\",\"data\":{\"id\":\"user_1\"}}";

    private final SvixSignatureVerifier verifier = new SvixSignatureVerifier(SECRET, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void acceptsCorrectSignature() {
        String signature = verifier.sign("msg_1", TIMESTAMP, BODY);

        assertThat(verifier.isValid("msg_1", TIMESTAMP, signature, BODY)).isTrue();
    }

    @Test
    void acceptsWhenAnyOfSeveralSignaturesMatches() {
        String signature = "v1,bm90LXRoZS1yaWdodC1vbmU= " + verifier.sign("msg_1", TIMESTAMP, BODY);

        assertThat(verifier.isValid("msg_1", TIMESTAMP, signature, BODY)).isTrue();
    }

    @Test
    void rejectsTamperedBody() {
        String signature = verifier.sign("msg_1", TIMESTAMP, BODY);

        assertThat(verifier.isValid("msg_1", TIMESTAMP, signature, BODY.replace("user_1", "user_2"))).isFalse();
    }

    @Test
    void rejectsSignatureFromAnotherSecret() {
        SvixSignatureVerifier other = new SvixSignatureVerifier("whsec_b3RoZXItc2VjcmV0LWtleS0xMjM0NTY=",
                Clock.fixed(NOW, ZoneOffset.UTC));

        assertThat(verifier.isValid("msg_1", TIMESTAMP, other.sign("msg_1", TIMESTAMP, BODY), BODY)).isFalse();
    }

    @Test
    void rejectsOldOrFutureTimestamps() {
        String old = String.valueOf(NOW.minusSeconds(6 * 60).getEpochSecond());
        String future = String.valueOf(NOW.plusSeconds(6 * 60).getEpochSecond());

        assertThat(verifier.isValid("msg_1", old, verifier.sign("msg_1", old, BODY), BODY)).isFalse();
        assertThat(verifier.isValid("msg_1", future, verifier.sign("msg_1", future, BODY), BODY)).isFalse();
    }

    @Test
    void rejectsMissingOrMalformedHeaders() {
        assertThat(verifier.isValid(null, TIMESTAMP, "v1,abc", BODY)).isFalse();
        assertThat(verifier.isValid("msg_1", "not-a-number", "v1,abc", BODY)).isFalse();
        assertThat(verifier.isValid("msg_1", TIMESTAMP, "garbage", BODY)).isFalse();
    }
}
