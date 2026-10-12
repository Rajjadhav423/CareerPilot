package com.careerpilot.backend.resume;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

import com.careerpilot.backend.docengine.PageSize;
import com.careerpilot.backend.resume.ResumeData.Section;

/**
 * Converts a resume in the editor's format (schema version 2: basics + typed sections) into docEngine JSON
 * (schema version 3) using a preset's classes, so existing resumes render through the new engine unchanged.
 * Text fields go through {@link RichText}, which only produces escaped text with strong/em/a.
 */
final class ResumeToDoc {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final Pattern MONTH_YEAR = Pattern.compile("(?i)([a-z]{3,9})\\.?\\s+(\\d{4})");
    private static final Pattern NUMERIC = Pattern.compile("(\\d{4})(?:[-/.](\\d{1,2}))?|(\\d{1,2})[-/.](\\d{4})");
    private static final List<String> MONTHS = List.of("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep",
            "oct", "nov", "dec");

    private ResumeToDoc() {
    }

    static ObjectNode convert(String presetId, PageSize pageSize, ResumeData raw) {
        ResumeData data = raw.normalized();
        ResumeView view = ResumeView.of(data);
        Set<String> ids = new HashSet<>();
        data.sections().forEach(s -> collectIds(s, ids));

        ObjectNode doc = JSON.objectNode();
        doc.put("schemaVersion", 3);
        doc.put("document", "resume");
        doc.put("preset", presetId);
        ObjectNode meta = doc.putObject("meta");
        meta.put("title", view.name() + " — Resume");
        meta.put("author", view.name());
        meta.put("subject", "Resume");
        meta.put("language", "en");
        ObjectNode page = doc.putObject("page");
        page.put("size", (pageSize == null ? PageSize.A4 : pageSize).name());
        if (data.layout() != null) {
            ResumeData.Layout l = data.layout();
            page.put("margin", String.format(Locale.ROOT, "%smm %smm %smm %smm", mm(l.top()), mm(l.right()), mm(l.bottom()), mm(l.left())));
        }
        ArrayNode sections = doc.putArray("sections");
        header(sections.addObject(), view, unique("header", ids));
        for (Section section : data.sections()) {
            if (section.visible()) {
                section(section, sections);
            }
        }
        return doc;
    }

    private static void header(ObjectNode section, ResumeView view, String id) {
        section.put("id", id);
        section.put("title", "Header");
        section.putObject("style").put("margin-top", "0");
        ArrayNode nodes = section.putArray("nodes");
        node(nodes, "h1", "name header", "name").put("text", view.name());
        if (view.headline() != null) {
            node(nodes, "p", "headline header", "headline").put("text", view.headline());
        }
        if (!view.contacts().isEmpty()) {
            ArrayNode parts = node(nodes, "p", "contact header", "contact").putArray("children");
            for (int i = 0; i < view.contacts().size(); i++) {
                ResumeView.Contact contact = view.contacts().get(i);
                if (i > 0) {
                    node(parts, "span", "sep", null).put("text", " | ");
                }
                if (contact.href() != null) {
                    ObjectNode link = node(parts, "a", "contact-link", "link");
                    link.putObject("attrs").put("href", contact.href());
                    link.put("text", contact.text());
                } else {
                    parts.addObject().put("tag", "span").put("text", contact.text());
                }
            }
        }
    }

    /** A visible section with something to show; empty ones are skipped like before. */
    private static void section(Section s, ArrayNode sections) {
        ObjectNode section = JSON.objectNode();
        section.put("id", s.id());
        section.put("title", s.title());
        ArrayNode nodes = section.putArray("nodes");
        node(nodes, "h2", "section-title", "section-title").put("text", s.title());
        boolean content = switch (s.type()) {
            case text -> text(s, nodes);
            case entries -> entries(s, nodes);
            case list -> list(s, nodes);
            case skills -> skills(s, nodes);
        };
        if (content) {
            sections.add(section);
        }
    }

    private static boolean text(Section s, ArrayNode nodes) {
        List<String> paragraphs = RichText.paragraphs(s.content());
        for (int i = 0; i < paragraphs.size(); i++) {
            node(nodes, "p", i == 0 ? "summary first" : "summary", "summary").put("html", paragraphs.get(i));
        }
        return !paragraphs.isEmpty();
    }

    private static boolean entries(Section s, ArrayNode nodes) {
        boolean first = true;
        for (ResumeData.Entry e : s.entries()) {
            if (!e.visible()) {
                continue;
            }
            ObjectNode entry = node(nodes, "div", first ? "entry first" : "entry", "entry");
            first = false;
            entry.put("id", e.id());
            ObjectNode data = entry.putObject("data");
            data.put("title", e.title());
            if (e.subtitle() != null) {
                data.put("org", e.subtitle());
            }
            isoDate(e.startDate()).ifPresent(d -> data.put("start", d));
            if (Boolean.TRUE.equals(e.current())) {
                data.putNull("end");
            } else {
                isoDate(e.endDate()).ifPresent(d -> data.put("end", d));
            }
            ArrayNode children = entry.putArray("children");

            ArrayNode head = node(children, "div", "entry-head", null).putArray("children");
            ArrayNode main = node(head, "div", "entry-main", null).putArray("children");
            ArrayNode title = node(main, "h3", "entry-title", "entry-title").putArray("children");
            title.addObject().put("tag", "span").put("text", e.title());
            ResumeView.link(e.url()).ifPresent(link -> {
                node(title, "span", "sep", null).put("text", " | ");
                ObjectNode a = node(title, "a", "entry-link", "link");
                a.putObject("attrs").put("href", link.href());
                a.put("text", link.text());
            });
            String subtitle = ResumeView.join(" · ", e.subtitle(), e.location());
            if (subtitle != null) {
                node(main, "p", "entry-subtitle", "organization").put("text", subtitle);
            }
            String dates = ResumeView.dates(e.startDate(), e.endDate(), Boolean.TRUE.equals(e.current()));
            if (dates != null) {
                node(head, "p", "entry-dates", "date").put("text", dates);
            }

            if (e.description() != null) {
                node(children, "p", "entry-description", null)
                        .put("html", String.join("<br/>", RichText.paragraphs(e.description())));
            }
            if (!e.bullets().isEmpty()) {
                ArrayNode bullets = node(children, "ul", "entry-highlights", null).putArray("children");
                e.bullets().forEach(b -> node(bullets, "li", null, "bullet").put("html", RichText.toXhtml(b)));
            }
        }
        return !first;
    }

    private static boolean list(Section s, ArrayNode nodes) {
        List<ResumeData.ListItem> items = s.items().stream().filter(ResumeData.ListItem::visible).toList();
        if (items.isEmpty()) {
            return false;
        }
        ArrayNode list = node(nodes, "ul", "list-items first", null).putArray("children");
        for (ResumeData.ListItem item : items) {
            ObjectNode li = node(list, "li", null, "bullet");
            li.put("id", item.id());
            li.put("html", RichText.toXhtml(item.text()));
        }
        return true;
    }

    private static boolean skills(Section s, ArrayNode nodes) {
        boolean first = true;
        for (ResumeData.SkillGroup g : s.groups()) {
            if (!g.visible() || (g.keywords().isEmpty() && g.name() == null)) {
                continue;
            }
            ObjectNode group = node(nodes, "p", first ? "skill first" : "skill", "skill-group");
            first = false;
            group.put("id", g.id());
            ArrayNode parts = group.putArray("children");
            if (g.name() != null) {
                node(parts, "span", "skill-name", null).put("text", g.name() + ":");
            }
            parts.addObject().put("tag", "span").put("text", (g.name() != null ? " " : "") + String.join(", ", g.keywords()));
        }
        return !first;
    }

    private static ObjectNode node(ArrayNode parent, String tag, String classes, String role) {
        ObjectNode node = parent.addObject();
        node.put("tag", tag);
        if (classes != null) {
            node.put("class", classes);
        }
        if (role != null) {
            node.put("role", role);
        }
        return node;
    }

    private static void collectIds(Section s, Set<String> ids) {
        ids.add(s.id());
        s.entries().forEach(e -> ids.add(e.id()));
        s.items().forEach(i -> ids.add(i.id()));
        s.groups().forEach(g -> ids.add(g.id()));
    }

    private static String unique(String base, Set<String> ids) {
        String candidate = base;
        int n = 1;
        while (ids.contains(candidate)) {
            candidate = base + "-" + n++;
        }
        ids.add(candidate);
        return candidate;
    }

    private static String mm(double value) {
        double clamped = Math.max(0, Math.min(40, value));
        return clamped == Math.rint(clamped) ? Long.toString((long) clamped) : Double.toString(Math.round(clamped * 10) / 10.0);
    }

    /** "Jan 2022" → "2022-01", "2022" → "2022", "01/2022" → "2022-01"; empty when it can't be read. */
    static java.util.Optional<String> isoDate(String value) {
        if (value == null) {
            return java.util.Optional.empty();
        }
        String v = value.strip();
        Matcher named = MONTH_YEAR.matcher(v);
        if (named.matches()) {
            int month = MONTHS.indexOf(named.group(1).substring(0, 3).toLowerCase(Locale.ROOT));
            return month < 0 ? java.util.Optional.of(named.group(2))
                    : java.util.Optional.of(named.group(2) + "-" + String.format(Locale.ROOT, "%02d", month + 1));
        }
        Matcher numeric = NUMERIC.matcher(v);
        if (numeric.matches()) {
            String year = numeric.group(1) != null ? numeric.group(1) : numeric.group(4);
            String month = numeric.group(1) != null ? numeric.group(2) : numeric.group(3);
            if (month == null) {
                return java.util.Optional.of(year);
            }
            int m = Integer.parseInt(month);
            return m >= 1 && m <= 12 ? java.util.Optional.of(year + "-" + String.format(Locale.ROOT, "%02d", m))
                    : java.util.Optional.of(year);
        }
        return java.util.Optional.empty();
    }
}
