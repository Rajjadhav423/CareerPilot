package com.careerpilot.backend.docengine;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Attribute;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.TextNode;

import com.careerpilot.backend.docengine.DocModel.Node;

/**
 * Reads a node's {@code html} string (doc-rules.md §5): inline formatting only, e.g. {@code "Cut latency by
 * <b>40%</b>"}. jsoup parses it like a browser would; we then keep only allowlisted inline tags and the
 * {@code href}/{@code title} of links, turning the result into nodes. Nothing from the string is printed
 * as-is: the writer escapes every text run and attribute again.
 */
final class InlineHtml {

    static final Set<String> TAGS = Set.of("b", "strong", "i", "em", "u", "s", "sub", "sup", "small", "mark", "code",
            "span", "a", "br");

    /** Dropped with their content in lenient mode (never unwrapped: their text isn't document text). */
    private static final Set<String> DANGEROUS = Set.of("script", "style", "iframe", "frame", "frameset", "object",
            "embed", "noscript", "template", "svg", "math", "img", "picture", "video", "audio", "source", "track",
            "canvas", "link", "meta", "base", "form", "input", "button", "select", "option", "textarea");

    /** A problem found in the string; {@code path} is relative to the html field. */
    record Problem(String code, String message) {
    }

    record Result(List<Node> nodes, String html, List<Problem> problems) {
    }

    private InlineHtml() {
    }

    static Result parse(String html) {
        List<Problem> problems = new ArrayList<>();
        Element body = Jsoup.parseBodyFragment(html).body();
        List<Node> nodes = children(body, problems, false);
        return new Result(nodes, toHtml(nodes), problems);
    }

    private static List<Node> children(Element parent, List<Problem> problems, boolean insideLink) {
        List<Node> nodes = new ArrayList<>();
        for (org.jsoup.nodes.Node child : parent.childNodes()) {
            if (child instanceof TextNode text) {
                if (!text.getWholeText().isEmpty()) {
                    nodes.add(Node.text(text.getWholeText()));
                }
            } else if (child instanceof Element element) {
                nodes.addAll(element(element, problems, insideLink));
            }
            // Comments, doctypes and processing instructions are ignored
        }
        return nodes;
    }

    private static List<Node> element(Element element, List<Problem> problems, boolean insideLink) {
        String tag = element.normalName();
        if (DANGEROUS.contains(tag)) {
            problems.add(new Problem("INLINE_TAG_NOT_ALLOWED", "<" + tag + "> isn't allowed in html; it was removed."));
            return List.of();
        }
        if (!TAGS.contains(tag) || (insideLink && "a".equals(tag))) {
            problems.add(new Problem("INLINE_TAG_NOT_ALLOWED", "<" + tag + "> isn't allowed in html (only "
                    + String.join(", ", TAGS.stream().sorted().toList()) + "); its text was kept."));
            return children(element, problems, insideLink);
        }

        Map<String, String> attrs = new LinkedHashMap<>();
        boolean link = "a".equals(tag);
        for (Attribute attribute : element.attributes()) {
            String key = attribute.getKey().toLowerCase(java.util.Locale.ROOT);
            if (link && "href".equals(key)) {
                var safe = SafeUrls.documentLink(attribute.getValue());
                if (safe.isPresent()) {
                    attrs.put("href", safe.get());
                } else {
                    problems.add(new Problem("UNSAFE_LINK", "Link \"" + CssRules.abbreviate(attribute.getValue())
                            + "\" isn't allowed (only https, http, mailto and tel); it's shown as text."));
                }
            } else if (link && "title".equals(key) && attribute.getValue().length() <= 200) {
                attrs.put("title", attribute.getValue());
            } else {
                problems.add(new Problem("INLINE_ATTR_NOT_ALLOWED", "Attribute \"" + key + "\" on <" + tag
                        + "> isn't allowed in html; style it with JSON instead. It was removed."));
            }
        }
        if (link && !attrs.containsKey("href")) {
            // A link without a usable address is just text
            return List.of(new Node(null, "span", List.of(), Map.of(), Map.of(), true, null, null,
                    children(element, problems, true), null, null));
        }
        List<Node> kids = "br".equals(tag) ? List.of() : children(element, problems, insideLink || link);
        return List.of(new Node(null, tag, List.of(), Map.of(), Map.copyOf(attrs), true, null, null, kids, null, null));
    }

    /** The sanitized nodes written back as an html string (for documents returned by lenient validation). */
    static String toHtml(List<Node> nodes) {
        StringBuilder out = new StringBuilder();
        write(nodes, out);
        return out.toString();
    }

    private static void write(List<Node> nodes, StringBuilder out) {
        for (Node node : nodes) {
            if (node.isText()) {
                out.append(Xml.escapeText(node.text()));
                continue;
            }
            out.append('<').append(node.tag());
            node.attrs().forEach((k, v) -> out.append(' ').append(k).append("=\"").append(Xml.escapeAttribute(v)).append('"'));
            if ("br".equals(node.tag())) {
                out.append(">");
                continue;
            }
            out.append('>');
            write(node.children(), out);
            out.append("</").append(node.tag()).append('>');
        }
    }
}
