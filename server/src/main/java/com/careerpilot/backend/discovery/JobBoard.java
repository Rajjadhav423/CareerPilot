package com.careerpilot.backend.discovery;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * One company's public job board, e.g. Groww on Greenhouse.
 * Configured as "provider:slug:Company Name", e.g. "greenhouse:groww:Groww".
 */
public record JobBoard(BoardProvider provider, String slug, String companyName) {

    /** Board slugs are plain identifiers; anything else (slashes, dots, hosts) is rejected at startup. */
    private static final Pattern SLUG = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]{0,99}");

    public static JobBoard parse(String value) {
        String[] parts = value.trim().split(":", 3);
        if (parts.length != 3 || parts[1].isBlank() || parts[2].isBlank()) {
            throw new IllegalArgumentException(
                    "Invalid job board '" + value + "'. Expected format provider:slug:Company Name");
        }
        BoardProvider provider;
        try {
            provider = BoardProvider.valueOf(parts[0].trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown job board provider '" + parts[0] + "' in '" + value + "'");
        }
        String slug = parts[1].trim();
        if (!SLUG.matcher(slug).matches()) {
            throw new IllegalArgumentException("Invalid job board slug '" + slug + "' in '" + value
                    + "'. Use letters, digits, '-' or '_' only");
        }
        return new JobBoard(provider, slug, parts[2].trim());
    }

    /** Short label used in logs and API responses, e.g. "Groww (Greenhouse)". */
    public String label() {
        return companyName + " (" + provider.displayName() + ")";
    }
}
