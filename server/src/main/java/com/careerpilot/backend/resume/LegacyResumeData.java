package com.careerpilot.backend.resume;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.regex.Pattern;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.careerpilot.backend.docengine.WebLink;

/**
 * The first resume format (fixed sections), kept only to read resumes saved before schema version 2 and
 * JSON written in that shape. {@link #toV2()} converts it; nothing new is stored in this format.
 */
public record LegacyResumeData(
        @NotNull(message = "is required") @Valid Basics basics,
        @Size(max = 2000) String summary,
        @Size(max = 30) List<@NotNull @Valid Experience> experience,
        @Size(max = 15) List<@NotNull @Valid Education> education,
        @Size(max = 20) List<@NotNull @Valid SkillGroup> skills,
        @Size(max = 20) List<@NotNull @Valid Project> projects,
        @Size(max = 20) List<@NotNull @Valid Certification> certifications,
        @Size(max = 10) List<@NotNull @Valid Language> languages) {

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

    public record Experience(
            @NotBlank(message = "is required") @Size(max = 120) String title,
            @NotBlank(message = "is required") @Size(max = 120) String organization,
            @Size(max = 100) String location,
            @Size(max = 30) String startDate,
            @Size(max = 30) String endDate,
            Boolean current,
            @Size(max = 15) List<@NotBlank @Size(max = 500) String> highlights) {
    }

    public record Education(
            @NotBlank(message = "is required") @Size(max = 150) String institution,
            @Size(max = 150) String degree,
            @Size(max = 150) String fieldOfStudy,
            @Size(max = 100) String location,
            @Size(max = 30) String startDate,
            @Size(max = 30) String endDate,
            @Size(max = 50) String grade,
            @Size(max = 10) List<@NotBlank @Size(max = 500) String> highlights) {
    }

    public record SkillGroup(
            @NotBlank(message = "is required") @Size(max = 60) String name,
            @Size(max = 40) List<@NotBlank @Size(max = 60) String> items) {
    }

    public record Project(
            @NotBlank(message = "is required") @Size(max = 120) String name,
            @WebLink String url,
            @Size(max = 1000) String description,
            @Size(max = 20) List<@NotBlank @Size(max = 40) String> technologies,
            @Size(max = 10) List<@NotBlank @Size(max = 500) String> highlights) {
    }

    public record Certification(
            @NotBlank(message = "is required") @Size(max = 150) String name,
            @Size(max = 150) String issuer,
            @Size(max = 30) String date,
            @WebLink String url) {
    }

    public record Language(
            @NotBlank(message = "is required") @Size(max = 60) String name,
            @Size(max = 60) String proficiency) {
    }

    // Control characters (except tab and newline) and lone surrogates aren't valid in XML/PDF text
    private static final Pattern UNPRINTABLE = Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F\\p{Cs}]");

    /**
     * A cleaned copy: text trimmed, unprintable characters removed, blank list entries dropped, missing
     * lists replaced by empty ones. Used both before saving and before rendering.
     */
    public LegacyResumeData normalized() {
        Basics b = basics == null ? new Basics(null, null, null, null, null, null) : basics;
        return new LegacyResumeData(
                new Basics(clean(b.fullName()), clean(b.headline()), clean(b.email()), clean(b.phone()),
                        clean(b.location()),
                        list(b.links(), l -> new Link(clean(l.label()), clean(l.url())), l -> l.url() != null)),
                cleanMultiline(summary),
                list(experience, e -> new Experience(clean(e.title()), clean(e.organization()), clean(e.location()),
                        clean(e.startDate()), clean(e.endDate()), Boolean.TRUE.equals(e.current()), strings(e.highlights())), Objects::nonNull),
                list(education, e -> new Education(clean(e.institution()), clean(e.degree()), clean(e.fieldOfStudy()),
                        clean(e.location()), clean(e.startDate()), clean(e.endDate()), clean(e.grade()),
                        strings(e.highlights())), Objects::nonNull),
                list(skills, s -> new SkillGroup(clean(s.name()), strings(s.items())), Objects::nonNull),
                list(projects, p -> new Project(clean(p.name()), clean(p.url()), cleanMultiline(p.description()),
                        strings(p.technologies()), strings(p.highlights())), Objects::nonNull),
                list(certifications, c -> new Certification(clean(c.name()), clean(c.issuer()), clean(c.date()),
                        clean(c.url())), Objects::nonNull),
                list(languages, l -> new Language(clean(l.name()), clean(l.proficiency())), Objects::nonNull));
    }

    /** The same resume as an ordered list of sections (schema version 2), in the order the old templates used. */
    public ResumeData toV2() {
        LegacyResumeData d = normalized();
        java.util.List<ResumeData.Section> sections = new java.util.ArrayList<>();
        if (d.summary() != null) {
            sections.add(new ResumeData.Section("summary", ResumeData.SectionType.text, "Summary", true, null, d.summary(), null, null));
        }
        if (!d.experience().isEmpty()) {
            sections.add(new ResumeData.Section("experience", ResumeData.SectionType.entries, "Experience", true,
                    d.experience().stream().map(e -> new ResumeData.Entry(null, e.title(), e.organization(), e.location(),
                            e.startDate(), e.endDate(), e.current(), null, null, e.highlights(), true)).toList(), null, null, null));
        }
        if (!d.projects().isEmpty()) {
            sections.add(new ResumeData.Section("projects", ResumeData.SectionType.entries, "Projects", true,
                    d.projects().stream().map(p -> new ResumeData.Entry(null, p.name(),
                            p.technologies().isEmpty() ? null : String.join(", ", p.technologies()), null, null, null, false,
                            p.url(), p.description(), p.highlights(), true)).toList(), null, null, null));
        }
        if (!d.education().isEmpty()) {
            sections.add(new ResumeData.Section("education", ResumeData.SectionType.entries, "Education", true,
                    d.education().stream().map(e -> {
                        String degree = java.util.stream.Stream.of(e.degree(), e.fieldOfStudy()).filter(Objects::nonNull)
                                .collect(java.util.stream.Collectors.joining(", "));
                        boolean hasDegree = !degree.isEmpty();
                        return new ResumeData.Entry(null, hasDegree ? degree : e.institution(), hasDegree ? e.institution() : null,
                                e.location(), e.startDate(), e.endDate(), false, null, e.grade(), e.highlights(), true);
                    }).toList(), null, null, null));
        }
        if (!d.skills().isEmpty()) {
            sections.add(new ResumeData.Section("skills", ResumeData.SectionType.skills, "Skills", true, null, null, null,
                    d.skills().stream().map(g -> new ResumeData.SkillGroup(null, g.name(), g.items(), true)).toList()));
        }
        if (!d.certifications().isEmpty()) {
            sections.add(new ResumeData.Section("certifications", ResumeData.SectionType.entries, "Certifications", true,
                    d.certifications().stream().map(c -> new ResumeData.Entry(null, c.name(), c.issuer(), null, null, c.date(),
                            false, c.url(), null, List.of(), true)).toList(), null, null, null));
        }
        if (!d.languages().isEmpty()) {
            sections.add(new ResumeData.Section("languages", ResumeData.SectionType.list, "Languages", true, null, null,
                    d.languages().stream().map(l -> new ResumeData.ListItem(null,
                            l.proficiency() == null ? l.name() : l.name() + " (" + l.proficiency() + ")", true)).toList(), null));
        }
        Basics b = d.basics();
        return new ResumeData(ResumeData.SCHEMA_VERSION, new ResumeData.Basics(b.fullName(), b.headline(), b.email(), b.phone(),
                b.location(), b.links().stream().map(l -> new ResumeData.Link(l.label(), l.url())).toList()), sections).normalized();
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

    private static List<String> strings(List<String> values) {
        return values == null ? List.of()
                : values.stream().filter(Objects::nonNull).map(LegacyResumeData::clean).filter(Objects::nonNull).toList();
    }

    private static <T> List<T> list(List<T> values, Function<T, T> cleaner, java.util.function.Predicate<T> keep) {
        return values == null ? List.of()
                : values.stream().filter(Objects::nonNull).map(cleaner).filter(keep).toList();
    }
}
