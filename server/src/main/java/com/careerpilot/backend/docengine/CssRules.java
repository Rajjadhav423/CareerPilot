package com.careerpilot.backend.docengine;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The CSS a document may use (see doc-rules.md §8). Every property is on an allowlist with its own value
 * check; anything that could fetch a resource ({@code url()}), run code, escape the page or break the CSS
 * syntax is refused. Values that pass are normalized (trimmed, lower-case keywords and units) and are safe to
 * print inside a {@code <style>} element or a {@code style} attribute.
 */
final class CssRules {

    /** A value that passed (code == null) or a reason it didn't. */
    record Check(String value, String code, String message) {
        static Check ok(String value) {
            return new Check(value, null, null);
        }

        static Check fail(String code, String message) {
            return new Check(null, code, message);
        }

        boolean passed() {
            return code == null;
        }
    }

    private interface Rule {
        Check check(String value);
    }

    private static final Pattern SAFE_CHARS = Pattern.compile("[A-Za-z0-9#.,%()\\s'\"_+-]*");
    private static final Pattern LENGTH = Pattern.compile("(-?\\d{1,4}(?:\\.\\d{1,3})?)(pt|mm|cm|in|px|em|%)?");
    private static final Pattern NUMBER = Pattern.compile("-?\\d{1,4}(?:\\.\\d{1,3})?");
    private static final Pattern HEX = Pattern.compile("#([0-9a-f]{3}|[0-9a-f]{6})");
    private static final Pattern RGB = Pattern.compile("rgba?\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*(?:,\\s*(0|1|0?\\.\\d+)\\s*)?\\)");

    static final Map<String, int[]> NAMED_COLORS = Map.ofEntries(
            Map.entry("black", rgb(0, 0, 0)), Map.entry("white", rgb(255, 255, 255)),
            Map.entry("gray", rgb(128, 128, 128)), Map.entry("grey", rgb(128, 128, 128)),
            Map.entry("dimgray", rgb(105, 105, 105)), Map.entry("darkgray", rgb(169, 169, 169)),
            Map.entry("lightgray", rgb(211, 211, 211)), Map.entry("silver", rgb(192, 192, 192)),
            Map.entry("red", rgb(255, 0, 0)), Map.entry("darkred", rgb(139, 0, 0)), Map.entry("maroon", rgb(128, 0, 0)),
            Map.entry("orange", rgb(255, 165, 0)), Map.entry("yellow", rgb(255, 255, 0)),
            Map.entry("olive", rgb(128, 128, 0)), Map.entry("green", rgb(0, 128, 0)),
            Map.entry("darkgreen", rgb(0, 100, 0)), Map.entry("teal", rgb(0, 128, 128)),
            Map.entry("navy", rgb(0, 0, 128)), Map.entry("blue", rgb(0, 0, 255)), Map.entry("darkblue", rgb(0, 0, 139)),
            Map.entry("purple", rgb(128, 0, 128)), Map.entry("brown", rgb(165, 42, 42)),
            Map.entry("transparent", rgb(255, 255, 255)));

    /** Properties that are refused with an explanation (rather than "unknown"). */
    private static final Map<String, String> BLOCKED = Map.ofEntries(
            Map.entry("position", "Positioning isn't supported; use margins, floats or tables."),
            Map.entry("transform", "Transforms aren't supported in PDF output."),
            Map.entry("filter", "Filters aren't supported in PDF output."),
            Map.entry("opacity", "Opacity isn't supported; use a lighter colour."),
            Map.entry("z-index", "Layering isn't supported."),
            Map.entry("background", "Only background-color is allowed (no images)."),
            Map.entry("background-image", "Background images aren't allowed."),
            Map.entry("content", "Generated content isn't allowed."),
            Map.entry("behavior", "Not allowed."),
            Map.entry("letter-spacing", "Letter spacing breaks PDF text extraction (ATS reads \"E X P E R I E N C E\")."),
            Map.entry("word-spacing", "Word spacing breaks PDF text extraction."),
            Map.entry("font", "Use font-family, font-size, font-weight and font-style separately."),
            Map.entry("list-style-image", "Images aren't allowed."),
            Map.entry("cursor", "Not meaningful in a PDF."),
            // The PDF engine ignores these: refuse them so the preview never silently differs from the request
            Map.entry("columns", "Multi-column layout isn't supported in PDF output; use a table with one cell per column."),
            Map.entry("column-count", "Multi-column layout isn't supported in PDF output; use a table with one cell per column."),
            Map.entry("column-gap", "Multi-column layout isn't supported in PDF output; use a table with one cell per column."),
            Map.entry("overflow-wrap", "Use \"word-wrap\": \"break-word\" (the PDF engine doesn't support overflow-wrap)."));

    private static final Map<String, Rule> RULES = new HashMap<>();

    static {
        // Text
        RULES.put("font-family", CssRules::fontFamily);
        RULES.put("font-size", v -> length(v, "font-size", 2.1, 14.2, false, true, false));
        RULES.put("font-weight", keywords("normal", "bold", "bolder", "lighter", "100", "200", "300", "400", "500", "600", "700", "800", "900"));
        RULES.put("font-style", keywords("normal", "italic", "oblique"));
        RULES.put("color", CssRules::color);
        RULES.put("line-height", CssRules::lineHeight);
        RULES.put("text-align", keywords("left", "right", "center", "justify", "start", "end"));
        RULES.put("text-decoration", CssRules::textDecoration);
        RULES.put("text-transform", keywords("none", "uppercase", "lowercase", "capitalize"));
        RULES.put("text-indent", v -> length(v, "text-indent", -50, 50, true, false, false));
        RULES.put("white-space", keywords("normal", "nowrap", "pre", "pre-wrap", "pre-line"));
        RULES.put("word-break", keywords("normal", "break-all", "keep-all", "break-word"));
        RULES.put("word-wrap", keywords("normal", "break-word"));
        RULES.put("vertical-align", v -> oneOf(v, Set.of("baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super"))
                .or(() -> lengthOpt(v, "vertical-align", -20, 20, true, false)).orElseGet(() -> invalid("vertical-align", v)));
        // Box
        for (String side : List.of("", "-top", "-right", "-bottom", "-left")) {
            RULES.put("margin" + side, side.isEmpty()
                    ? v -> sides(v, "margin", -20, 50, true, true)
                    : v -> sides(v, "margin" + side, -20, 50, true, true, 1));
            RULES.put("padding" + side, side.isEmpty()
                    ? v -> sides(v, "padding", 0, 50, false, true)
                    : v -> sides(v, "padding" + side, 0, 50, false, true, 1));
        }
        for (String size : List.of("width", "min-width", "max-width", "height", "min-height", "max-height")) {
            RULES.put(size, v -> "auto".equals(v) || ("none".equals(v) && size.startsWith("max"))
                    ? Check.ok(v) : length(v, size, 0, 300, false, false, true));
        }
        // Borders
        for (String side : List.of("", "-top", "-right", "-bottom", "-left")) {
            RULES.put("border" + side, v -> border(v, "border" + side));
            RULES.put("border" + side + "-width", v -> sides(v, "border" + side + "-width", 0, 3, false, false, side.isEmpty() ? 4 : 1));
            RULES.put("border" + side + "-style", v -> repeat(v, "border" + side + "-style", side.isEmpty() ? 4 : 1,
                    t -> oneOf(t, Set.of("none", "solid", "dashed", "dotted", "double"))));
            RULES.put("border" + side + "-color", v -> repeat(v, "border" + side + "-color", side.isEmpty() ? 4 : 1,
                    t -> Optional.of(color(t)).filter(Check::passed)));
        }
        RULES.put("border-radius", v -> sides(v, "border-radius", 0, 20, false, false, 4));
        RULES.put("border-collapse", keywords("collapse", "separate"));
        RULES.put("border-spacing", v -> sides(v, "border-spacing", 0, 10, false, false, 2));
        RULES.put("background-color", CssRules::color);
        // Layout
        RULES.put("display", CssRules::display);
        RULES.put("float", keywords("left", "right", "none"));
        RULES.put("clear", keywords("left", "right", "both", "none"));
        RULES.put("list-style-type", keywords("disc", "circle", "square", "decimal", "lower-alpha", "upper-alpha",
                "lower-roman", "upper-roman", "none"));
        RULES.put("list-style-position", keywords("inside", "outside"));
        // Pages
        RULES.put("page-break-before", keywords("auto", "always", "avoid", "left", "right"));
        RULES.put("page-break-after", keywords("auto", "always", "avoid", "left", "right"));
        RULES.put("page-break-inside", keywords("auto", "avoid"));
        RULES.put("orphans", v -> integer(v, "orphans", 1, 10));
        RULES.put("widows", v -> integer(v, "widows", 1, 10));
        RULES.put("-fs-page-break-min-height", v -> length(v, "-fs-page-break-min-height", 0, 150, false, false, false));
    }

    private CssRules() {
    }

    static Set<String> properties() {
        return RULES.keySet();
    }

    /** Checks one declaration. The property name must already be lower-case. */
    static Check check(String property, String rawValue) {
        if (BLOCKED.containsKey(property)) {
            return Check.fail("CSS_PROPERTY_BLOCKED", "\"" + property + "\" isn't allowed: " + BLOCKED.get(property));
        }
        Rule rule = RULES.get(property);
        if (rule == null) {
            return Check.fail("CSS_PROPERTY_UNKNOWN", "\"" + property + "\" isn't a supported CSS property.");
        }
        String value = rawValue == null ? "" : rawValue.strip().replaceAll("\\s+", " ");
        if (value.isEmpty() || value.length() > 200) {
            return Check.fail("CSS_VALUE_INVALID", property + " needs a value (at most 200 characters).");
        }
        String lower = value.toLowerCase(Locale.ROOT);
        if (lower.contains("url(") || lower.contains("expression") || lower.contains("!important")
                || lower.contains("/*") || lower.contains("\\") || !SAFE_CHARS.matcher(value).matches()) {
            return Check.fail("CSS_VALUE_BLOCKED", property + ": \"" + abbreviate(value)
                    + "\" isn't allowed (no url(), !important, comments or special characters).");
        }
        return rule.check(property.equals("font-family") ? value : lower);
    }

    /**
     * A contrast warning for a style that sets {@code color}: against its own background-color, or white.
     * Returns empty when fine or not computable.
     */
    static Optional<String> contrastWarning(Map<String, String> style) {
        String color = style.get("color");
        if (color == null) {
            return Optional.empty();
        }
        int[] fg = parseColor(color);
        int[] bg = style.containsKey("background-color") ? parseColor(style.get("background-color")) : rgb(255, 255, 255);
        if (fg == null || bg == null) {
            return Optional.empty();
        }
        double ratio = contrast(fg, bg);
        return ratio < 4.5
                ? Optional.of(String.format(Locale.ROOT, "Text contrast is %.1f:1; 4.5:1 or more is easier to read.", ratio))
                : Optional.empty();
    }

    // ---- value checks ----

    private static Rule keywords(String... allowed) {
        Set<String> set = Set.of(allowed);
        return v -> set.contains(v) ? Check.ok(v)
                : Check.fail("CSS_VALUE_INVALID", "Use one of: " + String.join(", ", allowed) + ".");
    }

    private static Optional<Check> oneOf(String v, Set<String> allowed) {
        return allowed.contains(v) ? Optional.of(Check.ok(v)) : Optional.empty();
    }

    private static Check invalid(String property, String value) {
        return Check.fail("CSS_VALUE_INVALID", property + ": \"" + abbreviate(value) + "\" isn't a valid value.");
    }

    /**
     * A length in the allowed range, given in mm (font-size range is in mm too: 2.1–14.2 mm ≈ 6–40 pt).
     * em is allowed for font-size (0.5–4) and treated as relative elsewhere (×4.23 mm).
     */
    private static Check length(String v, String property, double minMm, double maxMm, boolean allowNegative,
            boolean fontSize, boolean allowPercent) {
        return lengthOpt(v, property, minMm, maxMm, allowNegative, allowPercent, fontSize)
                .orElseGet(() -> Check.fail("CSS_VALUE_INVALID", property + ": \"" + abbreviate(v)
                        + "\" must be a length like 10pt, 4mm or 1.2em" + range(minMm, maxMm, fontSize) + "."));
    }

    private static Optional<Check> lengthOpt(String v, String property, double minMm, double maxMm, boolean allowNegative,
            boolean allowPercent) {
        return lengthOpt(v, property, minMm, maxMm, allowNegative, allowPercent, false);
    }

    private static Optional<Check> lengthOpt(String v, String property, double minMm, double maxMm, boolean allowNegative,
            boolean allowPercent, boolean fontSize) {
        Matcher m = LENGTH.matcher(v);
        if (!m.matches()) {
            return Optional.empty();
        }
        double number = Double.parseDouble(m.group(1));
        String unit = m.group(2);
        if (number < 0 && !allowNegative) {
            return Optional.empty();
        }
        if (unit == null) {
            // Unitless is only fine for zero
            return number == 0 ? Optional.of(Check.ok("0")) : Optional.empty();
        }
        if ("%".equals(unit)) {
            if (fontSize) {
                return number >= 50 && number <= 400 ? Optional.of(Check.ok(v)) : Optional.empty();
            }
            return allowPercent && number >= 0 && number <= 100 ? Optional.of(Check.ok(v)) : Optional.empty();
        }
        if ("em".equals(unit) && fontSize) {
            return number >= 0.5 && number <= 4 ? Optional.of(Check.ok(v)) : Optional.empty();
        }
        double mm = switch (unit) {
            case "pt" -> number * 25.4 / 72;
            case "mm" -> number;
            case "cm" -> number * 10;
            case "in" -> number * 25.4;
            case "px" -> number * 25.4 / 96;
            case "em" -> number * 4.23;
            default -> Double.NaN;
        };
        return mm >= minMm - 0.001 && mm <= maxMm + 0.001 ? Optional.of(Check.ok(v)) : Optional.empty();
    }

    private static String range(double minMm, double maxMm, boolean fontSize) {
        return fontSize ? " (6–40pt)" : String.format(Locale.ROOT, " (%s to %smm)", trim(minMm), trim(maxMm));
    }

    private static String trim(double value) {
        return value == Math.rint(value) ? Long.toString((long) value) : Double.toString(value);
    }

    /** 1–4 lengths (margin, padding, border-width…). */
    private static Check sides(String v, String property, double minMm, double maxMm, boolean allowNegative, boolean allowAuto) {
        return sides(v, property, minMm, maxMm, allowNegative, allowAuto, 4);
    }

    private static Check sides(String v, String property, double minMm, double maxMm, boolean allowNegative,
            boolean allowAuto, int max) {
        return repeat(v, property, max, t -> allowAuto && "auto".equals(t) ? Optional.of(Check.ok(t))
                : lengthOpt(t, property, minMm, maxMm, allowNegative, false))
                .code() == null ? Check.ok(v)
                : Check.fail("CSS_VALUE_INVALID", property + ": \"" + abbreviate(v) + "\" must be " + (max > 1 ? "1–" + max + " lengths" : "a length")
                        + " like 4mm or 6pt" + range(minMm, maxMm, false) + ".");
    }

    private static Check repeat(String v, String property, int max, java.util.function.Function<String, Optional<Check>> part) {
        String[] tokens = v.split(" ");
        if (tokens.length > max) {
            return invalid(property, v);
        }
        for (String token : tokens) {
            if (part.apply(token).filter(Check::passed).isEmpty()) {
                return invalid(property, v);
            }
        }
        return Check.ok(v);
    }

    private static Check integer(String v, String property, int min, int max) {
        if (v.matches("\\d{1,2}")) {
            int n = Integer.parseInt(v);
            if (n >= min && n <= max) {
                return Check.ok(v);
            }
        }
        return Check.fail("CSS_VALUE_INVALID", property + " must be a whole number from " + min + " to " + max + ".");
    }

    private static Check lineHeight(String v) {
        if ("normal".equals(v)) {
            return Check.ok(v);
        }
        if (NUMBER.matcher(v).matches()) {
            double n = Double.parseDouble(v);
            return n >= 0.8 && n <= 3 ? Check.ok(v) : Check.fail("CSS_VALUE_INVALID", "line-height must be 0.8–3 (e.g. 1.35).");
        }
        return lengthOpt(v, "line-height", 2, 30, false, false)
                .orElseGet(() -> Check.fail("CSS_VALUE_INVALID", "line-height must be a number like 1.35 or a length like 13pt."));
    }

    private static Check textDecoration(String v) {
        Set<String> parts = Set.of("none", "underline", "line-through", "overline");
        for (String token : v.split(" ")) {
            if (!parts.contains(token)) {
                return Check.fail("CSS_VALUE_INVALID", "text-decoration: use none, underline, line-through or overline.");
            }
        }
        return Check.ok(v);
    }

    private static Check display(String v) {
        if (v.contains("flex") || v.contains("grid")) {
            return Check.fail("CSS_LAYOUT_UNSUPPORTED",
                    "display: " + v + " isn't supported in PDF output; use a table or float for side-by-side layout.");
        }
        return keywords("block", "inline", "inline-block", "table", "table-row", "table-cell", "list-item", "none").check(v);
    }

    private static Check border(String v, String property) {
        if ("none".equals(v) || "0".equals(v)) {
            return Check.ok(v);
        }
        String[] tokens = v.split(" ");
        if (tokens.length > 3) {
            return invalid(property, v);
        }
        for (String token : tokens) {
            boolean ok = lengthOpt(token, property, 0, 3, false, false).isPresent()
                    || Set.of("none", "solid", "dashed", "dotted", "double").contains(token)
                    || color(token).passed();
            if (!ok) {
                return Check.fail("CSS_VALUE_INVALID", property + ": \"" + abbreviate(v)
                        + "\" should look like \"1pt solid #c1c7d0\" (width up to 3mm).");
            }
        }
        return Check.ok(v);
    }

    static Check color(String v) {
        return parseColor(v) != null ? Check.ok(v)
                : Check.fail("CSS_VALUE_INVALID", "\"" + abbreviate(v) + "\" isn't a colour. Use #rrggbb, #rgb, rgb(r, g, b) or a basic name like black.");
    }

    private static Check fontFamily(String v) {
        List<String> resolved = new ArrayList<>();
        for (String part : v.split(",")) {
            String name = part.strip().replaceAll("^['\"]|['\"]$", "");
            Optional<String> family = DocFonts.resolve(name);
            if (family.isEmpty()) {
                return Check.fail("CSS_FONT_UNAVAILABLE", "Font \"" + abbreviate(name) + "\" isn't available. Use one of: "
                        + String.join(", ", DocFonts.families()) + " (or serif / sans-serif).");
            }
            if (!resolved.contains(family.get())) {
                resolved.add(family.get());
            }
        }
        return Check.ok(String.join(", ", resolved.stream().map(f -> "\"" + f + "\"").toList()));
    }

    // ---- colours ----

    static int[] parseColor(String value) {
        String v = value.strip().toLowerCase(Locale.ROOT);
        if (NAMED_COLORS.containsKey(v)) {
            return NAMED_COLORS.get(v);
        }
        Matcher hex = HEX.matcher(v);
        if (hex.matches()) {
            String h = hex.group(1);
            if (h.length() == 3) {
                h = "" + h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
            }
            return rgb(Integer.parseInt(h.substring(0, 2), 16), Integer.parseInt(h.substring(2, 4), 16),
                    Integer.parseInt(h.substring(4, 6), 16));
        }
        Matcher m = RGB.matcher(v);
        if (m.matches()) {
            int r = Integer.parseInt(m.group(1));
            int g = Integer.parseInt(m.group(2));
            int b = Integer.parseInt(m.group(3));
            return r <= 255 && g <= 255 && b <= 255 ? rgb(r, g, b) : null;
        }
        return null;
    }

    private static int[] rgb(int r, int g, int b) {
        return new int[] {r, g, b};
    }

    private static double contrast(int[] a, int[] b) {
        double la = luminance(a);
        double lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    private static double luminance(int[] c) {
        double[] v = new double[3];
        for (int i = 0; i < 3; i++) {
            double s = c[i] / 255.0;
            v[i] = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    }

    static String abbreviate(String value) {
        return value.length() > 60 ? value.substring(0, 57) + "…" : value;
    }
}
