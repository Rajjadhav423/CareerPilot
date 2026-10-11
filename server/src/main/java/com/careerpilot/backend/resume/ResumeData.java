package com.careerpilot.backend.resume;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.careerpilot.backend.document.WebLink;

/**
 * The resume JSON format (schema version 2): basics plus an ordered list of sections the user chooses.
 * Published as JSON Schema at {@code GET /api/v1/resumes/schema} so people and AI assistants can write it.
 *
 * <ul>
 *   <li>Section {@code type} decides which field is used: {@code entries} (jobs, schools, projects…),
 *       {@code text} (paragraphs), {@code list} (bullet points) or {@code skills} (named groups of keywords).</li>
 *   <li>Sections and items carry ids so versions can be compared; missing ids are generated.</li>
 *   <li>Descriptions, bullets, list items and text allow **bold**, *italic* and [label](https://…) only
 *       (see {@link RichText}). Everything else is plain text, escaped when printed.</li>
 *   <li>Every string and list is capped so a single request can't produce an unbounded document.</li>
 * </ul>
 */
public record ResumeData(
        Integer schemaVersion,
        @NotNull(message = "is required") @Valid Basics basics,
        @Size(max = 25) List<@NotNull @Valid Section> sections) {

    public static final int SCHEMA_VERSION = 2;
    static final String ID_PATTERN = "[A-Za-z0-9_-]{1,40}";
    private static final Pattern ID = Pattern.compile(ID_PATTERN);

    public enum SectionType {
        entries, text, list, skills
    }

    public record Basics(
            @NotBlank(message = "is required") @Size(max = 100) String fullName,
            @Size(max = 150) String headline,
            @Size(max = 254) @Email(message = "must be an email address") String email,
            @Size(max = 40) String phone,
            @Size(max = 100) String location,
            @Size(max = 6) List<@NotNull @Valid Link> links) {
    }

    /** A profile or portfolio link, e.g. GitHub or LinkedIn. */
    public record Link(@Size(max = 40) String label, @NotBlank(message = "is required") @WebLink String url) {
    }

    /**
     * One section. Only the field matching {@code type} is used: {@code entries}, {@code content},
     * {@code items} or {@code groups}.
     */
    public record Section(
            @jakarta.validation.constraints.Pattern(regexp = ID_PATTERN, message = "may only use letters, digits, - and _") String id,
            @NotNull(message = "is required") SectionType type,
            @NotBlank(message = "is required") @Size(max = 60) String title,
            Boolean visible,
            @Size(max = 40) List<@NotNull @Valid Entry> entries,
            @Size(max = 4000) String content,
            @Size(max = 50) List<@NotNull @Valid ListItem> items,
            @Size(max = 30) List<@NotNull @Valid SkillGroup> groups) {
    }

    /** A job, degree, project, certification… Only the title is required. */
    public record Entry(
            @jakarta.validation.constraints.Pattern(regexp = ID_PATTERN, message = "may only use letters, digits, - and _") String id,
            @NotBlank(message = "is required") @Size(max = 150) String title,
            @Size(max = 150) String subtitle,
            @Size(max = 100) String location,
            @Size(max = 30) String startDate,
            @Size(max = 30) String endDate,
            Boolean current,
            @WebLink String url,
            @Size(max = 1500) String description,
            @Size(max = 20) List<@NotBlank @Size(max = 500) String> bullets,
            Boolean visible) {
    }

    public record ListItem(
            @jakarta.validation.constraints.Pattern(regexp = ID_PATTERN, message = "may only use letters, digits, - and _") String id,
            @NotBlank(message = "is required") @Size(max = 500) String text,
            Boolean visible) {
    }

    /** E.g. "Languages: Java, Go". The name is optional (a single ungrouped list of skills). */
    public record SkillGroup(
            @jakarta.validation.constraints.Pattern(regexp = ID_PATTERN, message = "may only use letters, digits, - and _") String id,
            @Size(max = 60) String name,
            @Size(max = 50) List<@NotBlank @Size(max = 60) String> keywords,
            Boolean visible) {
    }

    /**
     * A cleaned copy used before saving and rendering: text trimmed, unprintable characters removed,
     * fields that don't belong to a section's type dropped, empty items dropped, {@code visible} defaulted
     * to true, and missing or duplicate ids replaced with generated ones.
     */
    public ResumeData normalized() {
        Basics b = basics == null ? new Basics(null, null, null, null, null, null) : basics;
        Basics cleanBasics = new Basics(Text.clean(b.fullName()), Text.clean(b.headline()), Text.clean(b.email()),
                Text.clean(b.phone()), Text.clean(b.location()),
                nonNull(b.links()).stream()
                        .map(l -> new Link(Text.clean(l.label()), Text.clean(l.url())))
                        .filter(l -> l.url() != null).toList());

        Set<String> usedIds = new HashSet<>();
        List<Section> cleanSections = new ArrayList<>();
        int sectionIndex = 0;
        for (Section s : nonNull(sections)) {
            sectionIndex++;
            if (s.type() == null) {
                continue;
            }
            String sectionId = uniqueId(s.id(), "s" + sectionIndex, usedIds);
            List<Entry> entries = List.of();
            String content = null;
            List<ListItem> items = List.of();
            List<SkillGroup> groups = List.of();
            switch (s.type()) {
                case entries -> {
                    List<Entry> cleaned = new ArrayList<>();
                    int i = 0;
                    for (Entry e : nonNull(s.entries())) {
                        i++;
                        String title = Text.clean(e.title());
                        if (title == null) {
                            continue;
                        }
                        cleaned.add(new Entry(uniqueId(e.id(), sectionId + "-e" + i, usedIds), title,
                                Text.clean(e.subtitle()), Text.clean(e.location()), Text.clean(e.startDate()),
                                Boolean.TRUE.equals(e.current()) ? null : Text.clean(e.endDate()), Boolean.TRUE.equals(e.current()), Text.clean(e.url()),
                                Text.cleanMultiline(e.description()), Text.lines(e.bullets()), visible(e.visible())));
                    }
                    entries = List.copyOf(cleaned);
                }
                case text -> content = Text.cleanMultiline(s.content());
                case list -> {
                    List<ListItem> cleaned = new ArrayList<>();
                    int i = 0;
                    for (ListItem item : nonNull(s.items())) {
                        i++;
                        String text = Text.clean(item.text());
                        if (text != null) {
                            cleaned.add(new ListItem(uniqueId(item.id(), sectionId + "-i" + i, usedIds), text,
                                    visible(item.visible())));
                        }
                    }
                    items = List.copyOf(cleaned);
                }
                case skills -> {
                    List<SkillGroup> cleaned = new ArrayList<>();
                    int i = 0;
                    for (SkillGroup g : nonNull(s.groups())) {
                        i++;
                        List<String> keywords = Text.lines(g.keywords());
                        String name = Text.clean(g.name());
                        if (!keywords.isEmpty() || name != null) {
                            cleaned.add(new SkillGroup(uniqueId(g.id(), sectionId + "-g" + i, usedIds), name, keywords,
                                    visible(g.visible())));
                        }
                    }
                    groups = List.copyOf(cleaned);
                }
            }
            String title = Text.clean(s.title());
            cleanSections.add(new Section(sectionId, s.type(), title == null ? "Section" : title, visible(s.visible()),
                    entries, content, items, groups));
        }
        return new ResumeData(SCHEMA_VERSION, cleanBasics, List.copyOf(cleanSections));
    }

    private static boolean visible(Boolean value) {
        return value == null || value;
    }

    private static String uniqueId(String requested, String fallback, Set<String> used) {
        String candidate = requested != null && ID.matcher(requested).matches() ? requested : fallback;
        String unique = candidate;
        int n = 2;
        while (!used.add(unique)) {
            unique = candidate + "-" + n++;
        }
        return unique;
    }

    private static <T> List<T> nonNull(List<T> values) {
        return values == null ? List.of() : values.stream().filter(Objects::nonNull).toList();
    }

    /** Text cleaning shared by the resume formats. */
    static final class Text {
        // Control characters (except tab and newline) and lone surrogates aren't valid in XML/PDF text
        private static final Pattern UNPRINTABLE = Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F\\p{Cs}]");

        private Text() {
        }

        static String clean(String value) {
            if (value == null) {
                return null;
            }
            String cleaned = UNPRINTABLE.matcher(value).replaceAll("").replaceAll("\\s+", " ").strip();
            return cleaned.isEmpty() ? null : cleaned;
        }

        static String cleanMultiline(String value) {
            if (value == null) {
                return null;
            }
            String cleaned = UNPRINTABLE.matcher(value.replace("\r\n", "\n").replace('\r', '\n')).replaceAll("")
                    .replaceAll("[\\t ]+", " ").replaceAll(" *\n *", "\n").replaceAll("\n{3,}", "\n\n").strip();
            return cleaned.isEmpty() ? null : cleaned;
        }

        static List<String> lines(List<String> values) {
            return values == null ? List.of()
                    : values.stream().filter(Objects::nonNull).map(Text::clean).filter(Objects::nonNull).toList();
        }
    }
}
