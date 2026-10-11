package com.careerpilot.backend.auth.webhook;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Checks that a webhook really comes from Clerk. Clerk delivers webhooks through Svix, which signs
 * {@code "<svix-id>.<svix-timestamp>.<raw body>"} with HMAC-SHA256 using the endpoint's "whsec_..." secret.
 * See https://docs.svix.com/receiving/verifying-payloads/how-manual
 */
public final class SvixSignatureVerifier {

    /** Rejects old (replayed) or far-future deliveries. */
    static final Duration TOLERANCE = Duration.ofMinutes(5);

    private final byte[] key;
    private final Clock clock;

    public SvixSignatureVerifier(String secret, Clock clock) {
        String encoded = secret.startsWith("whsec_") ? secret.substring("whsec_".length()) : secret;
        this.key = Base64.getDecoder().decode(encoded);
        this.clock = clock;
    }

    public boolean isValid(String id, String timestamp, String signatureHeader, String body) {
        if (id == null || timestamp == null || signatureHeader == null || body == null) {
            return false;
        }
        Instant sentAt;
        try {
            sentAt = Instant.ofEpochSecond(Long.parseLong(timestamp));
        } catch (NumberFormatException e) {
            return false;
        }
        if (Duration.between(sentAt, clock.instant()).abs().compareTo(TOLERANCE) > 0) {
            return false;
        }
        byte[] expected = Base64.getEncoder().encode(hmac(id + "." + timestamp + "." + body));
        // Header holds one or more space-separated "v1,<base64 signature>" entries (several during key rotation).
        for (String entry : signatureHeader.split(" ")) {
            int comma = entry.indexOf(',');
            if (comma > 0 && entry.substring(0, comma).equals("v1")) {
                byte[] given = entry.substring(comma + 1).getBytes(StandardCharsets.US_ASCII);
                if (MessageDigest.isEqual(expected, given)) {
                    return true;
                }
            }
        }
        return false;
    }

    String sign(String id, String timestamp, String body) {
        return "v1," + Base64.getEncoder().encodeToString(hmac(id + "." + timestamp + "." + body));
    }

    private byte[] hmac(String content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(content.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }
}
