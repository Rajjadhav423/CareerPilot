package com.careerpilot.backend.resume;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.careerpilot.backend.resume.ResumeData.Section;

/**
 * What changed between two resumes, in words a person can review ("Experience › CRED: bullets changed").
 * Sections and items are matched by id, which is why the JSON format keeps ids: an assistant that edits a
 * resume should keep existing ids and give new items new ones. Formatting markers are ignored in the text.
 */
final class ResumeDiff {

    /**
     * @param kind    ADDED, REMOVED, CHANGED, MOVED, SHOWN or HIDDEN
     * @param where   human-readable location, e.g. "Experience › Software Engineer"
     * @param field   which field changed (CHANGED only), e.g. "bullets"
     * @param before  previous text (null when added)
     * @param after   new text (null when removed)
     */
    record Change(String kind, String where, String field, String before, String after) {
    }

    private ResumeDiff() {
    }

    /** "15 / 16 / 16 / 16 mm" (top / right / bottom / left), or null for the template default. */
    private static String margins(ResumeData data) {
        ResumeData.Layout l = data.layout();
        if (l == null) {
            return null;
        }
        return String.format(java.util.Locale.ROOT, "%s / %s / %s / %s mm", mm(l.top()), mm(l.right()), mm(l.bottom()),
                mm(l.left()));
    }

    private static String mm(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }

    static List<Change> between(ResumeData beforeRaw, ResumeData afterRaw) {
        ResumeData before = beforeRaw.normalized();
        ResumeData after = afterRaw.normalized();
        List<Change> changes = new ArrayList<>();

        field(changes, "Basics", "name", before.basics().fullName(), after.basics().fullName());
        field(changes, "Basics", "headline", before.basics().headline(), after.basics().headline());
        field(changes, "Basics", "email", before.basics().email(), after.basics().email());
        field(changes, "Basics", "phone", before.basics().phone(), after.basics().phone());
        field(changes, "Basics", "location", before.basics().location(), after.basics().location());
        field(changes, "Basics", "links", links(before), links(after));
        field(changes, "Page", "margins", margins(before), margins(after));

        Map<String, Section> old = byId(before.sections());
        Map<String, Section> current = byId(after.sections());
        List<String> oldOrder = new ArrayList<>(old.keySet());
        List<String> newOrder = new ArrayList<>(current.keySet());

        for (Section s : after.sections()) {
            Section previous = old.get(s.id());
            if (previous == null) {
                changes.add(new Change("ADDED", s.title(), null, null, summary(s)));
                continue;
            }
            String where = s.title();
            field(changes, where, "title", previous.title(), s.title());
            if (!Objects.equals(previous.visible(), s.visible())) {
                changes.add(new Change(s.visible() ? "SHOWN" : "HIDDEN", where, null, null, null));
            }
            if (previous.type() != s.type()) {
                changes.add(new Change("CHANGED", where, "type", previous.type().name(), s.type().name()));
                continue;
            }
            switch (s.type()) {
                case text -> field(changes, where, "text", RichText.toPlain(previous.content()), RichText.toPlain(s.content()));
                case entries -> items(changes, where, previous.entries(), s.entries(), ResumeData.Entry::id,
                        ResumeData.Entry::title, ResumeDiff::entryFields);
                case list -> items(changes, where, previous.items(), s.items(), ResumeData.ListItem::id,
                        i -> RichText.toPlain(i.text()), i -> Map.of("text", RichText.toPlain(i.text()), "visible", hidden(i.visible())));
                case skills -> items(changes, where, previous.groups(), s.groups(), ResumeData.SkillGroup::id,
                        g -> g.name() == null ? String.join(", ", g.keywords()) : g.name(),
                        g -> Map.of("name", Objects.toString(g.name(), ""), "skills", String.join(", ", g.keywords()),
                                "visible", hidden(g.visible())));
            }
        }
        for (Section s : before.sections()) {
            if (!current.containsKey(s.id())) {
                changes.add(new Change("REMOVED", s.title(), null, summary(s), null));
            }
        }
        oldOrder.retainAll(newOrder);
        newOrder.retainAll(oldOrder);
        if (!oldOrder.equals(newOrder)) {
            changes.add(new Change("MOVED", "Section order", null, titles(oldOrder, old), titles(newOrder, current)));
        }
        return changes;
    }

    private static <T> void items(List<Change> changes, String section, List<T> before, List<T> after,
            java.util.function.Function<T, String> id, java.util.function.Function<T, String> label,
            java.util.function.Function<T, Map<String, String>> fields) {
        Map<String, T> old = new LinkedHashMap<>();
        before.forEach(item -> old.put(id.apply(item), item));
        Map<String, T> current = new LinkedHashMap<>();
        after.forEach(item -> current.put(id.apply(item), item));

        for (T item : after) {
            T previous = old.get(id.apply(item));
            String where = section + " › " + label.apply(item);
            if (previous == null) {
                changes.add(new Change("ADDED", where, null, null, String.join(" · ", nonBlank(fields.apply(item)))));
                continue;
            }
            Map<String, String> was = fields.apply(previous);
            Map<String, String> now = fields.apply(item);
            now.forEach((name, value) -> field(changes, where, name, was.get(name), value));
        }
        for (T item : before) {
            if (!current.containsKey(id.apply(item))) {
                changes.add(new Change("REMOVED", section + " › " + label.apply(item), null,
                        String.join(" · ", nonBlank(fields.apply(item))), null));
            }
        }
        List<String> oldOrder = new ArrayList<>(old.keySet());
        List<String> newOrder = new ArrayList<>(current.keySet());
        oldOrder.retainAll(newOrder);
        newOrder.retainAll(oldOrder);
        if (!oldOrder.equals(newOrder)) {
            changes.add(new Change("MOVED", section, null, null, null));
        }
    }

    private static Map<String, String> entryFields(ResumeData.Entry e) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("title", e.title());
        fields.put("subtitle", Objects.toString(e.subtitle(), ""));
        fields.put("location", Objects.toString(e.location(), ""));
        fields.put("dates", Objects.toString(ResumeView.dates(e.startDate(), e.endDate(), Boolean.TRUE.equals(e.current())), ""));
        fields.put("link", Objects.toString(e.url(), ""));
        fields.put("description", Objects.toString(RichText.toPlain(e.description()), ""));
        fields.put("bullets", String.join("\n", e.bullets().stream().map(RichText::toPlain).toList()));
        fields.put("visible", hidden(e.visible()));
        return fields;
    }

    private static String hidden(Boolean visible) {
        return visible == null || visible ? "shown" : "hidden";
    }

    private static void field(List<Change> changes, String where, String name, String before, String after) {
        String a = before == null ? "" : before;
        String b = after == null ? "" : after;
        if (!a.equals(b)) {
            changes.add(new Change("CHANGED", where, name, a.isEmpty() ? null : a, b.isEmpty() ? null : b));
        }
    }

    private static List<String> nonBlank(Map<String, String> fields) {
        return fields.entrySet().stream()
                .filter(e -> !e.getKey().equals("visible"))
                .map(Map.Entry::getValue).filter(v -> v != null && !v.isBlank()).toList();
    }

    private static String links(ResumeData data) {
        return String.join(", ", data.basics().links().stream().map(ResumeData.Link::url).toList());
    }

    private static Map<String, Section> byId(List<Section> sections) {
        Map<String, Section> map = new LinkedHashMap<>();
        sections.forEach(s -> map.put(s.id(), s));
        return map;
    }

    private static String titles(List<String> ids, Map<String, Section> sections) {
        return String.join(" → ", ids.stream().map(id -> sections.get(id).title()).toList());
    }

    private static String summary(Section s) {
        return switch (s.type()) {
            case text -> RichText.toPlain(s.content());
            case entries -> s.entries().size() + " item(s)";
            case list -> s.items().size() + " item(s)";
            case skills -> s.groups().size() + " group(s)";
        };
    }
}
