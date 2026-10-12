package com.careerpilot.backend.resume;

import java.util.ArrayList;
import java.util.List;

import com.careerpilot.backend.docengine.SafeUrls;

/**
 * The tiny formatting language allowed inside resume text: {@code **bold**}, {@code *italic*} (or
 * {@code _italic_}) and {@code [label](https://…)}. Anything else is printed literally; a backslash escapes a
 * marker ({@code \*}). No nesting, no HTML: the output is built here with every character escaped, and links
 * only survive if {@link SafeUrls#webLink} accepts them (otherwise just the label is printed).
 *
 * The result is XHTML for Thymeleaf's {@code th:utext}; it can contain only {@code <strong>}, {@code <em>} and
 * {@code <a href>} tags created by this class.
 */
final class RichText {

    private RichText() {
    }

    /** Safe XHTML for one line or paragraph of resume text. */
    static String toXhtml(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        StringBuilder out = new StringBuilder(text.length() + 16);
        int i = 0;
        while (i < text.length()) {
            char c = text.charAt(i);
            if (c == '\\' && i + 1 < text.length() && "*_[]()\\".indexOf(text.charAt(i + 1)) >= 0) {
                escape(text.charAt(i + 1), out);
                i += 2;
                continue;
            }
            if (c == '*' && text.startsWith("**", i)) {
                int end = text.indexOf("**", i + 2);
                if (end > i + 2) {
                    out.append("<strong>").append(escape(text.substring(i + 2, end))).append("</strong>");
                    i = end + 2;
                    continue;
                }
            }
            if ((c == '*' || c == '_') && i + 1 < text.length() && !Character.isWhitespace(text.charAt(i + 1))) {
                int end = text.indexOf(c, i + 1);
                // "_" only counts at word boundaries, so snake_case words stay intact
                boolean boundary = c == '*' || ((i == 0 || !Character.isLetterOrDigit(text.charAt(i - 1)))
                        && (end + 1 >= text.length() || !Character.isLetterOrDigit(text.charAt(end + 1))));
                if (end > i + 1 && boundary && !Character.isWhitespace(text.charAt(end - 1))) {
                    out.append("<em>").append(escape(text.substring(i + 1, end))).append("</em>");
                    i = end + 1;
                    continue;
                }
            }
            if (c == '[') {
                int close = text.indexOf("](", i + 1);
                int end = close < 0 ? -1 : closingParen(text, close + 2);
                if (close > i + 1 && end > close + 2) {
                    String label = text.substring(i + 1, close);
                    String url = text.substring(close + 2, end);
                    String safe = SafeUrls.webLink(url).orElse(null);
                    if (safe != null) {
                        out.append("<a href=\"").append(escape(safe)).append("\">").append(escape(label)).append("</a>");
                    } else {
                        out.append(escape(label));
                    }
                    i = end + 1;
                    continue;
                }
            }
            escape(c, out);
            i++;
        }
        return out.toString();
    }

    /** Plain text without markers (used for diffs and summaries). */
    static String toPlain(String text) {
        if (text == null) {
            return null;
        }
        return toXhtml(text).replaceAll("<[^>]+>", "").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'").replace("&amp;", "&");
    }

    /** Splits text into paragraphs at blank lines and formats each one. */
    static List<String> paragraphs(String text) {
        List<String> paragraphs = new ArrayList<>();
        if (text == null) {
            return paragraphs;
        }
        for (String paragraph : text.split("\n\\s*\n")) {
            String joined = paragraph.replace('\n', ' ').strip();
            if (!joined.isEmpty()) {
                paragraphs.add(toXhtml(joined));
            }
        }
        return paragraphs;
    }

    /** Index of the ")" that closes a link target starting at {@code from}, allowing balanced parentheses inside. */
    private static int closingParen(String text, int from) {
        int depth = 0;
        for (int j = from; j < text.length(); j++) {
            char c = text.charAt(j);
            if (c == '(') {
                depth++;
            } else if (c == ')') {
                if (depth == 0) {
                    return j;
                }
                depth--;
            } else if (Character.isWhitespace(c)) {
                return -1;
            }
        }
        return -1;
    }

    private static String escape(String value) {
        StringBuilder out = new StringBuilder(value.length());
        value.chars().forEach(c -> escape((char) c, out));
        return out.toString();
    }

    private static void escape(char c, StringBuilder out) {
        switch (c) {
            case '&' -> out.append("&amp;");
            case '<' -> out.append("&lt;");
            case '>' -> out.append("&gt;");
            case '"' -> out.append("&quot;");
            case '\'' -> out.append("&#39;");
            default -> out.append(c);
        }
    }
}
