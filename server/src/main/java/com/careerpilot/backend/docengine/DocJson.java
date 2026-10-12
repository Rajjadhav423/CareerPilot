package com.careerpilot.backend.docengine;

import java.util.Map;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

import com.careerpilot.backend.docengine.DocModel.Doc;
import com.careerpilot.backend.docengine.DocModel.Node;
import com.careerpilot.backend.docengine.DocModel.Section;

/** Writes a {@link Doc} back as document JSON (e.g. the repaired document from lenient validation). */
final class DocJson {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;

    private DocJson() {
    }

    static ObjectNode write(Doc doc) {
        ObjectNode root = JSON.objectNode();
        root.put("schemaVersion", 3);
        root.put("document", doc.document().name());
        if (doc.preset() != null) {
            root.put("preset", doc.preset());
        }
        ObjectNode meta = root.putObject("meta");
        putIfSet(meta, "title", doc.meta().title());
        putIfSet(meta, "author", doc.meta().author());
        putIfSet(meta, "subject", doc.meta().subject());
        meta.put("language", doc.meta().language());
        ObjectNode page = root.putObject("page");
        page.put("size", doc.page().size().name());
        page.put("margin", doc.page().margin());
        page.put("maxPages", doc.page().maxPages());
        page.put("pageNumbers", doc.page().pageNumbers());
        if (!doc.styles().isEmpty()) {
            ObjectNode styles = root.putObject("styles");
            doc.styles().forEach((selector, style) -> styles.set(selector, style(style)));
        }
        ArrayNode sections = root.putArray("sections");
        for (Section section : doc.sections()) {
            ObjectNode s = sections.addObject();
            s.put("id", section.id());
            putIfSet(s, "title", section.title());
            if (!section.visible()) {
                s.put("visible", false);
            }
            if (!section.style().isEmpty()) {
                s.set("style", style(section.style()));
            }
            ArrayNode nodes = s.putArray("nodes");
            section.nodes().forEach(node -> nodes.add(node(node)));
        }
        return root;
    }

    private static JsonNode node(Node node) {
        ObjectNode n = JSON.objectNode();
        putIfSet(n, "id", node.id());
        n.put("tag", node.tag());
        if (!node.classes().isEmpty()) {
            n.put("class", String.join(" ", node.classes()));
        }
        if (!node.style().isEmpty()) {
            n.set("style", style(node.style()));
        }
        if (!node.attrs().isEmpty()) {
            n.set("attrs", style(node.attrs()));
        }
        if (!node.visible()) {
            n.put("visible", false);
        }
        putIfSet(n, "role", node.role());
        if (node.data() != null) {
            n.set("data", node.data());
        }
        if (node.text() != null) {
            n.put("text", node.text());
        } else if (node.html() != null) {
            n.put("html", node.html());
        } else if (!node.children().isEmpty()) {
            ArrayNode children = n.putArray("children");
            node.children().forEach(child -> children.add(node(child)));
        }
        return n;
    }

    private static ObjectNode style(Map<String, String> values) {
        ObjectNode style = JSON.objectNode();
        values.forEach(style::put);
        return style;
    }

    private static void putIfSet(ObjectNode node, String name, String value) {
        if (value != null) {
            node.put(name, value);
        }
    }
}
