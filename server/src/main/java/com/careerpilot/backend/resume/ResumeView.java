package com.careerpilot.backend.resume;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.careerpilot.backend.docengine.SafeUrls;
import com.careerpilot.backend.resume.ResumeData.Section;

/**
 * Display-ready resume for the templates: hidden and empty parts removed, dates joined, links checked and
 * formatted text converted to safe XHTML by {@link RichText}. Fields ending in {@code Html} are already escaped
 * (printed with {@code th:utext}); all other text is printed with {@code th:text}, which escapes it.
 */
public record ResumeView(String name, String headline, List<Contact> contacts, List<SectionView> sections) {

    /** Text with an optional safe link (http(s) or mailto). */
    public record Contact(String text, String href) {
    }

    /** {@code type} is "entries", "text", "list" or "skills"; only the matching list is filled. */
    public record SectionView(String title, String type, List<String> paragraphsHtml, List<EntryView> entries,
            List<String> itemsHtml, List<SkillView> skills) {
    }

    public record EntryView(String title, Contact link, String subtitle, String dates, String descriptionHtml,
            List<String> bulletsHtml) {
    }

    public record SkillView(String name, String keywords) {
    }

    static ResumeView of(ResumeData raw) {
        ResumeData data = raw.normalized();
        ResumeData.Basics basics = data.basics();

        List<Contact> contacts = new ArrayList<>();
        if (basics.email() != null) {
            contacts.add(new Contact(basics.email(), "mailto:" + basics.email()));
        }
        if (basics.phone() != null) {
            contacts.add(new Contact(basics.phone(), null));
        }
        if (basics.location() != null) {
            contacts.add(new Contact(basics.location(), null));
        }
        for (ResumeData.Link link : basics.links()) {
            link(link.url()).ifPresent(contacts::add);
        }

        List<SectionView> sections = data.sections().stream()
                .filter(Section::visible)
                .map(ResumeView::section)
                .filter(Objects::nonNull)
                .toList();
        return new ResumeView(basics.fullName(), basics.headline(), List.copyOf(contacts), sections);
    }

    private static SectionView section(Section s) {
        return switch (s.type()) {
            case text -> {
                List<String> paragraphs = RichText.paragraphs(s.content());
                yield paragraphs.isEmpty() ? null : new SectionView(s.title(), "text", paragraphs, List.of(), List.of(), List.of());
            }
            case entries -> {
                List<EntryView> entries = s.entries().stream().filter(ResumeData.Entry::visible)
                        .map(e -> new EntryView(e.title(), link(e.url()).orElse(null), join(" · ", e.subtitle(), e.location()),
                                dates(e.startDate(), e.endDate(), Boolean.TRUE.equals(e.current())),
                                e.description() == null ? null : String.join("<br/>", RichText.paragraphs(e.description())),
                                e.bullets().stream().map(RichText::toXhtml).toList()))
                        .toList();
                yield entries.isEmpty() ? null : new SectionView(s.title(), "entries", List.of(), entries, List.of(), List.of());
            }
            case list -> {
                List<String> items = s.items().stream().filter(ResumeData.ListItem::visible)
                        .map(i -> RichText.toXhtml(i.text())).toList();
                yield items.isEmpty() ? null : new SectionView(s.title(), "list", List.of(), List.of(), items, List.of());
            }
            case skills -> {
                List<SkillView> groups = s.groups().stream().filter(ResumeData.SkillGroup::visible)
                        .filter(g -> !g.keywords().isEmpty() || g.name() != null)
                        .map(g -> new SkillView(g.name(), String.join(", ", g.keywords())))
                        .toList();
                yield groups.isEmpty() ? null : new SectionView(s.title(), "skills", List.of(), List.of(), List.of(), groups);
            }
        };
    }

    /** Link text without the scheme ("github.com/raj"), which reads better and survives ATS link stripping. */
    static java.util.Optional<Contact> link(String url) {
        return SafeUrls.webLink(url).map(safe -> {
            String text = safe.replaceFirst("^https?://(www\\.)?", "");
            if (text.endsWith("/")) {
                text = text.substring(0, text.length() - 1);
            }
            return new Contact(text, safe);
        });
    }

    static String dates(String start, String end, boolean current) {
        String finish = current ? "Present" : end;
        if (isBlank(start)) {
            return isBlank(finish) ? null : finish;
        }
        return isBlank(finish) ? start : start + " – " + finish;
    }

    static String join(String separator, String... parts) {
        String joined = Stream.of(parts).filter(Objects::nonNull).filter(p -> !p.isBlank())
                .collect(Collectors.joining(separator));
        return joined.isEmpty() ? null : joined;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
