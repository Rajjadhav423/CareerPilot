package com.careerpilot.backend.template;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Finds and fills {@code {{key}}} placeholders. Plain text substitution only: template content is never
 * evaluated as code, and values are inserted as literal text (HTML escaping happens when the email is built).
 */
public final class MergeFields {

    /** Bounded and non-nested, so matching stays linear even on hostile input. */
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([^{}\\r\\n]{0,64})}}");

    private MergeFields() {
    }

    /**
     * @param text    the text with placeholders filled where a value was available
     * @param missing allowlisted fields that had no value; their placeholders are left in the text
     * @param unknown placeholders that are not allowlisted (or malformed brace fragments), left in the text
     */
    public record Resolution(String text, Set<MergeField> missing, List<String> unknown) {
    }

    /** Fills allowlisted placeholders that have a non-blank value; never invents values for the rest. */
    public static Resolution resolve(String text, Map<MergeField, String> values) {
        Set<MergeField> missing = EnumSet.noneOf(MergeField.class);
        Set<String> unknown = new LinkedHashSet<>();
        Matcher matcher = PLACEHOLDER.matcher(text);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1).trim();
            String replacement = matcher.group();
            var field = MergeField.fromKey(key);
            if (field.isEmpty()) {
                unknown.add(matcher.group());
            } else {
                String value = values.get(field.get());
                if (value == null || value.isBlank()) {
                    missing.add(field.get());
                    replacement = field.get().placeholder();
                } else {
                    replacement = value;
                }
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        unknown.addAll(strayBraces(text));
        return new Resolution(out.toString(), missing, List.copyOf(unknown));
    }

    /** Placeholders a template may not contain: not allowlisted, or malformed braces such as "{{job_title". */
    public static List<String> invalidPlaceholders(String text) {
        Set<String> invalid = new LinkedHashSet<>();
        Matcher matcher = PLACEHOLDER.matcher(text);
        while (matcher.find()) {
            if (MergeField.fromKey(matcher.group(1).trim()).isEmpty()) {
                invalid.add(matcher.group());
            }
        }
        invalid.addAll(strayBraces(text));
        return List.copyOf(invalid);
    }

    /** Every placeholder-like fragment still in a composed email. Sending is blocked while any remain. */
    public static List<String> remainingPlaceholders(String text) {
        Set<String> remaining = new LinkedHashSet<>();
        Matcher matcher = PLACEHOLDER.matcher(text);
        while (matcher.find()) {
            remaining.add(matcher.group());
        }
        remaining.addAll(strayBraces(text));
        return new ArrayList<>(remaining);
    }

    /** "{{" or "}}" left over after removing well-formed placeholders. */
    private static List<String> strayBraces(String text) {
        String rest = PLACEHOLDER.matcher(text).replaceAll("");
        List<String> stray = new ArrayList<>();
        if (rest.contains("{{")) {
            stray.add("{{");
        }
        if (rest.contains("}}")) {
            stray.add("}}");
        }
        return stray;
    }
}
