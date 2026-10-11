package com.careerpilot.backend.document;

/** Paper size of a generated document. A4 is the default outside North America. */
public enum PageSize {
    A4("A4"),
    LETTER("letter");

    private final String css;

    PageSize(String css) {
        this.css = css;
    }

    /** Value for the CSS {@code @page { size: … }} rule. */
    public String css() {
        return css;
    }
}
