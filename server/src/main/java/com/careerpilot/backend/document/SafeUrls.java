package com.careerpilot.backend.document;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Decides which user-supplied links may appear in a generated document.
 *
 * Links are only written into the PDF as clickable annotations; the server never fetches them, so they
 * can't be used for server-side requests. This check stops dangerous schemes (javascript:, data:, file:,
 * …) and look-alike tricks (credentials in the URL) from reaching a reader's PDF viewer.
 */
public final class SafeUrls {

    public static final int MAX_LENGTH = 500;

    private static final Set<String> WEB_SCHEMES = Set.of("http", "https");

    private SafeUrls() {
    }

    /**
     * Returns the normalized link, or empty if it isn't an absolute http(s) URL we're willing to print.
     * A missing scheme is treated as https ("github.com/raj" → "https://github.com/raj").
     */
    public static Optional<String> webLink(String value) {
        if (value == null) {
            return Optional.empty();
        }
        String trimmed = value.strip();
        if (trimmed.isEmpty() || trimmed.length() > MAX_LENGTH || containsWhitespaceOrControl(trimmed)) {
            return Optional.empty();
        }
        String candidate = trimmed.contains("://") ? trimmed : looksLikeScheme(trimmed) ? trimmed : "https://" + trimmed;
        try {
            URI uri = new URI(candidate);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!WEB_SCHEMES.contains(scheme) || uri.getRawUserInfo() != null) {
                return Optional.empty();
            }
            String host = uri.getHost();
            if (host == null || host.isBlank() || !host.contains(".") && !host.equals("localhost")) {
                return Optional.empty();
            }
            return Optional.of(uri.toASCIIString());
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
    }

    /** True for a value we can turn into a safe link, see {@link #webLink(String)}. Blank counts as valid (optional). */
    public static boolean isAcceptableWebLink(String value) {
        return value == null || value.isBlank() || webLink(value).isPresent();
    }

    private static boolean looksLikeScheme(String value) {
        // "javascript:alert(1)", "mailto:x", "data:…": keep the scheme so the check above rejects it
        int colon = value.indexOf(':');
        if (colon <= 0) {
            return false;
        }
        String head = value.substring(0, colon);
        return head.chars().allMatch(c -> Character.isLetterOrDigit(c) || c == '+' || c == '-' || c == '.')
                && !value.substring(colon + 1).matches("\\d+(/.*)?");
    }

    private static boolean containsWhitespaceOrControl(String value) {
        return value.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c));
    }
}
