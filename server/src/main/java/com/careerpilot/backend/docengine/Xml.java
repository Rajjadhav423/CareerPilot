package com.careerpilot.backend.docengine;

import java.util.regex.Pattern;

/** Escaping for the XHTML the engine writes. Characters that aren't allowed in XML are removed. */
final class Xml {

    // Control characters (except tab, newline, carriage return) and lone surrogates aren't valid in XML/PDF text
    private static final Pattern INVALID = Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F\\uFFFE\\uFFFF]"
            + "|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]");

    private Xml() {
    }

    static String clean(String value) {
        return value == null ? "" : INVALID.matcher(value).replaceAll("");
    }

    static String escapeText(String value) {
        return clean(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    static String escapeAttribute(String value) {
        return escapeText(value).replace("\"", "&quot;").replace("'", "&#39;").replace("\n", "&#10;");
    }
}
