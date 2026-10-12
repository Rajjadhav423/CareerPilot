package com.careerpilot.backend.docengine;

import java.util.List;
import java.util.Map;

import tools.jackson.databind.JsonNode;

/**
 * A validated document (docengine JSON, schema version 3). Only {@link DocReader} creates these, so every
 * value here has already passed the rules in {@code docengine/spec/doc-rules.md}: allowed tags, attributes,
 * CSS properties and values, links, fonts and limits. The writer can print them without further checks.
 */
public final class DocModel {

    private DocModel() {
    }

    public enum Kind {
        resume, coverLetter
    }

    /** The whole document. {@code styles} keeps insertion order: later rules win, like CSS. */
    public record Doc(
            int schemaVersion,
            Kind document,
            String preset,
            Meta meta,
            Page page,
            Map<String, Map<String, String>> styles,
            List<Section> sections) {
    }

    /** PDF metadata and language. */
    public record Meta(String title, String author, String subject, String language) {
    }

    /** @param margin normalized CSS shorthand in mm, e.g. "15mm 16mm 16mm 16mm" */
    public record Page(PageSize size, String margin, int maxPages, boolean pageNumbers) {
    }

    /** Printed as {@code <section id="…" class="section">}. Hidden sections are kept but not printed. */
    public record Section(String id, String title, boolean visible, Map<String, String> style, List<Node> nodes) {
    }

    /**
     * One element. {@code tag} is "#text" for a plain text run (only inside {@code children} built from an
     * {@code html} string). Content is {@code text}, or {@code children} (given directly or parsed from
     * {@code html}, which is also kept, sanitized, so the document can be written back the same way).
     */
    public record Node(
            String id,
            String tag,
            List<String> classes,
            Map<String, String> style,
            Map<String, String> attrs,
            boolean visible,
            String text,
            String html,
            List<Node> children,
            String role,
            JsonNode data) {

        static final String TEXT = "#text";

        static Node text(String value) {
            return new Node(null, TEXT, List.of(), Map.of(), Map.of(), true, value, null, List.of(), null, null);
        }

        boolean isText() {
            return TEXT.equals(tag);
        }
    }
}
