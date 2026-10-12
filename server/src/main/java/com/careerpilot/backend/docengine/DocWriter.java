package com.careerpilot.backend.docengine;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.careerpilot.backend.docengine.DocModel.Doc;
import com.careerpilot.backend.docengine.DocModel.Node;
import com.careerpilot.backend.docengine.DocModel.Section;

/**
 * Writes a validated {@link Doc} as XHTML with its CSS inlined. The same markup is printed to PDF and shown
 * in browser previews.
 *
 * Cascade (doc-rules.md §3): engine defaults → preset styles → document styles → the node's own style.
 * Everything printed comes from {@link DocReader}: tags, attributes and CSS are allowlisted and every text
 * and attribute value is escaped here, so a document can't inject markup, scripts or resource loads.
 */
final class DocWriter {

    private static final String ENGINE_CSS = """
            html { color: #1f2328; }
            body { margin: 0; font-family: "Inter"; font-size: 10pt; line-height: 1.38; }
            h1, h2, h3, h4, h5, h6, p, ul, ol, dl, dd, blockquote, pre, address, figure { margin: 0; }
            h1 { font-size: 20pt; font-weight: 700; }
            h2 { font-size: 12pt; font-weight: 700; }
            h3 { font-size: 10.5pt; font-weight: 700; }
            h4, h5, h6 { font-size: 10pt; font-weight: 700; }
            h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
            a { color: inherit; text-decoration: none; }
            ul, ol { padding-left: 13pt; }
            li { margin: 1.5pt 0; }
            p, li { orphans: 2; widows: 2; }
            strong, b { font-weight: 700; }
            em, i { font-style: italic; }
            blockquote { padding-left: 8pt; border-left: 1.5pt solid #c1c7d0; }
            pre { white-space: pre-wrap; }
            hr { border: 0; border-top: 0.75pt solid #c1c7d0; margin: 4pt 0; }
            table { border-collapse: collapse; width: 100%; }
            td, th { vertical-align: top; text-align: left; padding: 0; }
            h1, h2, h3, h4, h5, h6, p, li, dt, dd, td, th, address, blockquote { word-wrap: break-word; }
            """;

    private DocWriter() {
    }

    /** @param presetStyles the styles of the document's preset (empty when it has none) */
    static String toXhtml(Doc doc, Map<String, Map<String, String>> presetStyles) {
        StringBuilder out = new StringBuilder(8192);
        String language = doc.meta().language();
        out.append("<!DOCTYPE html>\n<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"").append(Xml.escapeAttribute(language))
                .append("\" class=\"page-").append(doc.page().size().css()).append("\">\n<head>\n<meta charset=\"UTF-8\" />\n");
        String title = doc.meta().title() != null ? doc.meta().title()
                : doc.document() == DocModel.Kind.coverLetter ? "Cover letter" : "Resume";
        out.append("<title>").append(Xml.escapeText(title)).append("</title>\n");
        if (doc.meta().author() != null) {
            out.append("<meta name=\"author\" content=\"").append(Xml.escapeAttribute(doc.meta().author())).append("\" />\n");
        }
        String subject = doc.meta().subject() != null ? doc.meta().subject()
                : doc.document() == DocModel.Kind.coverLetter ? "Cover letter" : "Resume";
        out.append("<meta name=\"subject\" content=\"").append(Xml.escapeAttribute(subject)).append("\" />\n");
        out.append("<style>\n").append(css(doc, presetStyles)).append("</style>\n</head>\n<body>\n");
        for (Section section : doc.sections()) {
            if (!section.visible()) {
                continue;
            }
            out.append("<section id=\"").append(Xml.escapeAttribute(section.id())).append("\" class=\"section\"");
            styleAttribute(section.style(), out);
            out.append(">\n");
            for (Node node : section.nodes()) {
                node(node, out, false);
                out.append('\n');
            }
            out.append("</section>\n");
        }
        out.append("</body>\n</html>\n");
        return out.toString();
    }

    static String css(Doc doc, Map<String, Map<String, String>> presetStyles) {
        StringBuilder css = new StringBuilder(4096);
        css.append("@page {\n  size: ").append(doc.page().size().css()).append(";\n  margin: ").append(doc.page().margin()).append(";\n");
        if (doc.page().pageNumbers()) {
            css.append("""
                      @bottom-right {
                        content: "Page " counter(page) " of " counter(pages);
                        font-family: "Inter";
                        font-size: 7.5pt;
                        color: #6b6e76;
                      }
                    """);
        }
        css.append("}\n").append(ENGINE_CSS);
        rules(presetStyles, css);
        rules(doc.styles(), css);
        // Browser preview: a paper sheet with the page margins as padding; phones reflow
        css.append("@media screen {\n  html { background: #e9ebee; }\n  body { box-sizing: border-box; width: ")
                .append(doc.page().size() == PageSize.LETTER ? "215.9mm" : "210mm").append("; min-height: ")
                .append(doc.page().size() == PageSize.LETTER ? "279.4mm" : "297mm").append("; margin: 24px auto; padding: ")
                .append(doc.page().margin()).append("; background: #ffffff; box-shadow: 0 1px 4px rgba(9, 30, 66, 0.25); }\n}\n")
                .append("@media screen and (max-width: 860px) {\n  html { background: #ffffff; }\n")
                .append("  body { width: auto; min-height: 0; margin: 0; padding: 16px; box-shadow: none; }\n}\n");
        return css.toString();
    }

    private static void rules(Map<String, Map<String, String>> styles, StringBuilder css) {
        for (Map.Entry<String, Map<String, String>> rule : styles.entrySet()) {
            if (rule.getValue().isEmpty()) {
                continue;
            }
            css.append(rule.getKey()).append(" { ").append(declarations(rule.getValue())).append(" }\n");
        }
    }

    private static String declarations(Map<String, String> style) {
        return style.entrySet().stream().map(d -> d.getKey() + ": " + d.getValue() + ";").collect(Collectors.joining(" "));
    }

    private static void styleAttribute(Map<String, String> style, StringBuilder out) {
        if (!style.isEmpty()) {
            out.append(" style=\"").append(Xml.escapeAttribute(declarations(style))).append('"');
        }
    }

    private static void node(Node node, StringBuilder out, boolean preformatted) {
        if (node.isText()) {
            text(node.text(), out, preformatted);
            return;
        }
        if (!node.visible()) {
            return;
        }
        String tag = node.tag();
        out.append('<').append(tag);
        if (node.id() != null) {
            out.append(" id=\"").append(Xml.escapeAttribute(node.id())).append('"');
        }
        if (!node.classes().isEmpty()) {
            out.append(" class=\"").append(Xml.escapeAttribute(String.join(" ", node.classes()))).append('"');
        }
        styleAttribute(node.style(), out);
        if (node.role() != null) {
            out.append(" data-role=\"").append(Xml.escapeAttribute(node.role())).append('"');
        }
        node.attrs().forEach((name, value) -> out.append(' ').append(name).append("=\"").append(Xml.escapeAttribute(value)).append('"'));
        if ("a".equals(tag) && !node.attrs().containsKey("title")) {
            // Accessible name for the PDF link annotation (PDF/UA): the link's own text
            String label = plainText(node).strip();
            if (!label.isEmpty()) {
                out.append(" title=\"").append(Xml.escapeAttribute(label.length() > 200 ? label.substring(0, 200) : label)).append('"');
            }
        }
        if ("br".equals(tag) || "hr".equals(tag)) {
            out.append(" />");
            return;
        }
        out.append('>');
        boolean pre = preformatted || "pre".equals(tag);
        if (node.text() != null) {
            text(node.text(), out, pre);
        }
        List<Node> children = node.children();
        for (Node child : children) {
            node(child, out, pre);
        }
        out.append("</").append(tag).append('>');
    }

    private static String plainText(Node node) {
        if (node.text() != null) {
            return node.text();
        }
        StringBuilder text = new StringBuilder();
        node.children().forEach(child -> text.append(plainText(child)));
        return text.toString();
    }

    /** Escaped text; line breaks become {@code <br/>} (kept as newlines inside {@code <pre>}). */
    private static void text(String value, StringBuilder out, boolean preformatted) {
        String escaped = Xml.escapeText(value);
        out.append(preformatted ? escaped : escaped.replace("\r\n", "\n").replace("\n", "<br />"));
    }
}
