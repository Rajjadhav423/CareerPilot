package com.careerpilot.backend.docengine;

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

    private static final java.util.regex.Pattern MAILTO =
            java.util.regex.Pattern.compile("(?i)mailto:([A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\\.[A-Za-z]{2,24})(\\?[A-Za-z0-9=&%._+-]{0,200})?");

    /** A phone number: digits with an optional leading +, and spaces, dashes, dots or brackets between. */
    private static final java.util.regex.Pattern TEL = java.util.regex.Pattern.compile("(?i)tel:(\\+?[0-9(][0-9 ().-]{2,28}[0-9])");

    /**
     * A link for a document: a web link (see {@link #webLink(String)}), a {@code mailto:} address with an
     * optional simple query (subject=…) or a {@code tel:} phone number (spaces removed). Anything else
     * (javascript:, data:, file:, …) is empty.
     */
    public static Optional<String> documentLink(String value) {
        if (value == null) {
            return Optional.empty();
        }
        String trimmed = value.strip();
        if (trimmed.regionMatches(true, 0, "mailto:", 0, 7)) {
            return trimmed.length() <= MAX_LENGTH && MAILTO.matcher(trimmed).matches()
                    ? Optional.of("mailto:" + trimmed.substring(7)) : Optional.empty();
        }
        if (trimmed.regionMatches(true, 0, "tel:", 0, 4)) {
            java.util.regex.Matcher tel = TEL.matcher(trimmed);
            return tel.matches() ? Optional.of("tel:" + tel.group(1).replaceAll("[ ().-]", "")) : Optional.empty();
        }
        return webLink(trimmed);
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
