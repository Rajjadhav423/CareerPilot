package com.careerpilot.backend.resume;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jsoup.Jsoup;

import tools.jackson.databind.JsonNode;

import com.careerpilot.backend.resume.ResumeDiff.Change;

/**
 * Differences between two docEngine documents, in the same shape as {@link ResumeDiff} so the review screen
 * works for both. Sections are matched by id; inside a section, top-level nodes are matched by id when they
 * have one and by position otherwise. Text is compared as plain text (formatting tags ignored); style, page and
 * preset changes are reported separately.
 */
final class DocDiff {

    private static final int MAX_TEXT = 400;

    private DocDiff() {
    }

    static List<Change> between(JsonNode before, JsonNode after) {
        List<Change> changes = new ArrayList<>();
        field(changes, "Document", "preset", text(before.get("preset")), text(after.get("preset")));
        field(changes, "Document", "page", compact(before.get("page")), compact(after.get("page")));
        field(changes, "Document", "styles", compact(before.get("styles")), compact(after.get("styles")));

        Map<String, JsonNode> old = byId(before.path("sections"));
        Map<String, JsonNode> current = byId(after.path("sections"));
        for (Map.Entry<String, JsonNode> entry : current.entrySet()) {
            JsonNode section = entry.getValue();
            JsonNode previous = old.get(entry.getKey());
            String where = label(section);
            if (previous == null) {
                changes.add(new Change("ADDED", where, null, null, cut(plain(section.path("nodes")))));
                continue;
            }
            boolean visible = section.path("visible").asBoolean(true);
            if (previous.path("visible").asBoolean(true) != visible) {
                changes.add(new Change(visible ? "SHOWN" : "HIDDEN", where, null, null, null));
            }
            field(changes, where, "style", compact(previous.get("style")), compact(section.get("style")));
            nodes(changes, where, previous.path("nodes"), section.path("nodes"));
        }
        for (Map.Entry<String, JsonNode> entry : old.entrySet()) {
            if (!current.containsKey(entry.getKey())) {
                changes.add(new Change("REMOVED", label(entry.getValue()), null, cut(plain(entry.getValue().path("nodes"))), null));
            }
        }
        List<String> oldOrder = old.keySet().stream().filter(current::containsKey).toList();
        List<String> newOrder = current.keySet().stream().filter(old::containsKey).toList();
        if (!oldOrder.equals(newOrder)) {
            changes.add(new Change("MOVED", "Section order", null, String.join(", ", oldOrder), String.join(", ", newOrder)));
        }
        return changes;
    }

    private static void nodes(List<Change> changes, String section, JsonNode before, JsonNode after) {
        Map<String, JsonNode> old = byKey(before);
        Map<String, JsonNode> current = byKey(after);
        for (Map.Entry<String, JsonNode> entry : current.entrySet()) {
            JsonNode node = entry.getValue();
            JsonNode previous = old.get(entry.getKey());
            String where = section + " › " + nodeLabel(node, entry.getKey());
            if (previous == null) {
                changes.add(new Change("ADDED", where, null, null, cut(plain(node))));
                continue;
            }
            field(changes, where, "text", plain(previous), plain(node));
            field(changes, where, "style", compact(previous.get("style")) + compact(previous.get("class")),
                    compact(node.get("style")) + compact(node.get("class")));
            if (previous.path("visible").asBoolean(true) != node.path("visible").asBoolean(true)) {
                changes.add(new Change(node.path("visible").asBoolean(true) ? "SHOWN" : "HIDDEN", where, null, null, null));
            }
        }
        for (Map.Entry<String, JsonNode> entry : old.entrySet()) {
            if (!current.containsKey(entry.getKey())) {
                changes.add(new Change("REMOVED", section + " › " + nodeLabel(entry.getValue(), entry.getKey()), null,
                        cut(plain(entry.getValue())), null));
            }
        }
    }

    private static Map<String, JsonNode> byId(JsonNode sections) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        int i = 0;
        for (JsonNode section : sections.values()) {
            map.put(section.path("id").asString("#" + i), section);
            i++;
        }
        return map;
    }

    /** Nodes with an id are matched by id; others by their position among the id-less nodes. */
    private static Map<String, JsonNode> byKey(JsonNode nodes) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        int position = 0;
        for (JsonNode node : nodes.values()) {
            String id = node.path("id").asString(null);
            map.put(id != null ? "id:" + id : "#" + position++, node);
        }
        return map;
    }

    private static String label(JsonNode section) {
        String title = section.path("title").asString(null);
        return title != null ? title : section.path("id").asString("Section");
    }

    private static String nodeLabel(JsonNode node, String key) {
        String text = plain(node);
        String tag = node.path("tag").asString("node");
        if (text.isEmpty()) {
            return key.startsWith("id:") ? key.substring(3) : "<" + tag + ">";
        }
        return text.length() > 50 ? text.substring(0, 47) + "…" : text;
    }

    /** The node's visible text (text, html without tags, or children), spaces collapsed. */
    static String plain(JsonNode node) {
        StringBuilder out = new StringBuilder();
        collect(node, out);
        return out.toString().replaceAll("\\s+", " ").strip();
    }

    private static void collect(JsonNode node, StringBuilder out) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isArray()) {
            node.values().forEach(child -> {
                collect(child, out);
                out.append(' ');
            });
            return;
        }
        if (!node.isObject()) {
            return;
        }
        if (node.has("text")) {
            out.append(node.path("text").asString(""));
        } else if (node.has("html")) {
            out.append(Jsoup.parseBodyFragment(node.path("html").asString("")).text());
        } else if (node.has("children")) {
            collect(node.get("children"), out);
        } else if (node.has("nodes")) {
            collect(node.get("nodes"), out);
        }
    }

    private static void field(List<Change> changes, String where, String name, String before, String after) {
        String a = before == null ? "" : before;
        String b = after == null ? "" : after;
        if (!Objects.equals(a, b)) {
            changes.add(new Change("CHANGED", where, name, a.isEmpty() ? null : cut(a), b.isEmpty() ? null : cut(b)));
        }
    }

    private static String text(JsonNode node) {
        return node == null || node.isNull() ? null : node.asString();
    }

    private static String compact(JsonNode node) {
        return node == null || node.isNull() ? "" : node.toString();
    }

    private static String cut(String value) {
        return value.length() > MAX_TEXT ? value.substring(0, MAX_TEXT - 1) + "…" : value;
    }
}
