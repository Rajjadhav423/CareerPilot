package com.careerpilot.backend.gmail;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

/**
 * Builds the RFC 5322 message Gmail sends: a plain-text part and an HTML part, both base64 encoded.
 * <ul>
 *   <li>Header values must be single-line (no CR/LF), which prevents header injection.</li>
 *   <li>The HTML part is the plain text, HTML-escaped, so merge-field values can't inject markup.</li>
 *   <li>A non-ASCII subject is RFC 2047 encoded.</li>
 * </ul>
 * From is left out on purpose: Gmail sets it to the authenticated account.
 */
public final class MimeMessageBuilder {

    private static final String CRLF = "\r\n";

    private MimeMessageBuilder() {
    }

    public static String build(String to, String subject, String textBody) {
        requireSingleLine("recipient", to);
        requireSingleLine("subject", subject);
        String boundary = "careerpilot_" + UUID.randomUUID().toString().replace("-", "");
        String text = normaliseLineBreaks(textBody);

        StringBuilder message = new StringBuilder()
                .append("To: ").append(to).append(CRLF)
                .append("Subject: ").append(encodeHeader(subject)).append(CRLF)
                .append("MIME-Version: 1.0").append(CRLF)
                .append("Content-Type: multipart/alternative; boundary=\"").append(boundary).append('"').append(CRLF)
                .append(CRLF);
        appendPart(message, boundary, "text/plain", text);
        appendPart(message, boundary, "text/html", toHtml(text));
        message.append("--").append(boundary).append("--").append(CRLF);
        return message.toString();
    }

    /** Escapes the five HTML-significant characters. Values are never interpreted as markup. */
    public static String escapeHtml(String value) {
        StringBuilder out = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    private static String toHtml(String text) {
        String escaped = escapeHtml(text).replace(CRLF, "<br>" + CRLF);
        return "<!doctype html><html><body><div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;"
                + "line-height:1.5\">" + escaped + "</div></body></html>";
    }

    private static void appendPart(StringBuilder message, String boundary, String contentType, String content) {
        message.append("--").append(boundary).append(CRLF)
                .append("Content-Type: ").append(contentType).append("; charset=UTF-8").append(CRLF)
                .append("Content-Transfer-Encoding: base64").append(CRLF)
                .append(CRLF)
                .append(Base64.getMimeEncoder(76, CRLF.getBytes(StandardCharsets.US_ASCII))
                        .encodeToString(content.getBytes(StandardCharsets.UTF_8)))
                .append(CRLF);
    }

    /** RFC 2047 "B" encoding in chunks short enough for an encoded-word (≤ 75 chars). */
    static String encodeHeader(String value) {
        if (value.chars().allMatch(c -> c >= 0x20 && c < 0x7f)) {
            return value;
        }
        StringBuilder out = new StringBuilder();
        StringBuilder chunk = new StringBuilder();
        value.codePoints().forEach(codePoint -> {
            String next = new String(Character.toChars(codePoint));
            if ((chunk + next).getBytes(StandardCharsets.UTF_8).length > 45) {
                appendEncodedWord(out, chunk.toString());
                chunk.setLength(0);
            }
            chunk.append(next);
        });
        appendEncodedWord(out, chunk.toString());
        return out.toString();
    }

    private static void appendEncodedWord(StringBuilder out, String text) {
        if (text.isEmpty()) {
            return;
        }
        if (!out.isEmpty()) {
            out.append(CRLF).append(' ');
        }
        out.append("=?UTF-8?B?")
                .append(Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8)))
                .append("?=");
    }

    private static String normaliseLineBreaks(String text) {
        return text.replace("\r\n", "\n").replace('\r', '\n').replace("\n", CRLF);
    }

    private static void requireSingleLine(String field, String value) {
        if (value == null || value.isBlank() || value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0) {
            throw new IllegalArgumentException(field + " must be a non-empty single line");
        }
    }
}
