package com.careerpilot.backend.resume;

import static com.careerpilot.backend.resume.ResumeDocumentServiceTest.resume;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.junit.jupiter.api.Test;

import com.careerpilot.backend.docengine.SafeUrls;
import com.careerpilot.backend.resume.ResumeData.Basics;
import com.careerpilot.backend.resume.ResumeData.Entry;
import com.careerpilot.backend.resume.ResumeData.Link;
import com.careerpilot.backend.resume.ResumeData.Section;
import com.careerpilot.backend.resume.ResumeData.SectionType;

import tools.jackson.databind.json.JsonMapper;

class ResumeDataValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void aCompleteResumeIsValid() {
        assertThat(validator.validate(ResumeDocumentServiceTest.sample())).isEmpty();
    }

    @Test
    void onlyTheFullNameIsRequired() {
        assertThat(paths(new ResumeData(null, new Basics("Raj", null, null, null, null, null), null))).isEmpty();
        assertThat(paths(new ResumeData(null, new Basics(" ", null, null, null, null, null), null))).containsExactly("basics.fullName");
        assertThat(paths(new ResumeData(null, null, null))).containsExactly("basics");
    }

    @Test
    void badEmailsUnsafeLinksAndBadIdsAreRejected() {
        ResumeData data = new ResumeData(2,
                new Basics("Raj", null, "not-an-email", null, null, List.of(
                        new Link("x", "javascript:alert(1)"), new Link("z", "https://user:pw@evil.example"),
                        new Link("ok", "github.com/raj"))),
                List.of(new Section("../evil", SectionType.entries, "Projects", null,
                        List.of(new Entry(null, "P", null, null, null, null, false, "data:text/html,hi", null, null, null)),
                        null, null, null)));

        assertThat(paths(data)).containsExactlyInAnyOrder("basics.email", "basics.links[0].url", "basics.links[1].url",
                "sections[0].id", "sections[0].entries[0].url");
    }

    @Test
    void sectionsAndTheirContentAreCapped() {
        Entry job = new Entry(null, "Engineer", null, null, null, null, false, null, "d".repeat(1501),
                Collections.nCopies(21, "Did a thing"), null);
        Section big = new Section("s", SectionType.entries, "x".repeat(61), null, Collections.nCopies(41, job), "c".repeat(4001), null, null);
        ResumeData data = new ResumeData(2, new Basics("Raj", null, null, null, null, null), Collections.nCopies(26, big));

        assertThat(paths(data)).contains("sections", "sections[0].title", "sections[0].entries", "sections[0].content",
                "sections[0].entries[0].description", "sections[0].entries[0].bullets");
    }

    @Test
    void sectionsNeedATypeAndTitle() {
        ResumeData data = resume(new Section(null, null, " ", null, null, null, null, null));

        assertThat(paths(data)).contains("sections[0].type", "sections[0].title");
    }

    @Test
    void normalizingFillsIdsCleansTextAndDropsFieldsOfOtherTypes() {
        ResumeData data = new ResumeData(null, new Basics("  Raj \u0000 Jadhav ", "", null, null, null, null), List.of(
                new Section(null, SectionType.text, " About ", null,
                        List.of(new Entry(null, "ignored", null, null, null, null, false, null, null, null, null)),
                        "  Hello  ", null, null),
                new Section("dup", SectionType.entries, "Work", false,
                        List.of(new Entry("dup", " Dev ", null, null, null, "2020", true, null, null,
                                java.util.Arrays.asList(" a ", null, "  "), null),
                                new Entry(null, "  ", null, null, null, null, false, null, null, null, null)),
                        "ignored", null, null))).normalized();

        assertThat(data.schemaVersion()).isEqualTo(2);
        assertThat(data.basics().fullName()).isEqualTo("Raj Jadhav");
        assertThat(data.basics().headline()).isNull();
        Section about = data.sections().get(0);
        assertThat(about.id()).isEqualTo("s1");
        assertThat(about.title()).isEqualTo("About");
        assertThat(about.content()).isEqualTo("Hello");
        assertThat(about.entries()).isEmpty();
        assertThat(about.visible()).isTrue();
        Section work = data.sections().get(1);
        assertThat(work.visible()).isFalse();
        assertThat(work.content()).isNull();
        assertThat(work.entries()).hasSize(1);
        Entry dev = work.entries().getFirst();
        assertThat(dev.id()).isEqualTo("dup-2"); // the section already uses "dup"
        assertThat(dev.title()).isEqualTo("Dev");
        assertThat(dev.endDate()).isNull(); // current job: no end date
        assertThat(dev.bullets()).containsExactly("a");
    }

    @Test
    void theOriginalFixedSectionFormatIsConverted() {
        JsonMapper mapper = JsonMapper.builder().build();
        ResumeData data = new ResumeJson(mapper).read("""
                {"basics": {"fullName": "Raj", "links": [{"url": "github.com/raj"}]},
                 "summary": "Engineer.",
                 "experience": [{"title": "Dev", "organization": "CRED", "current": true, "highlights": ["Built it"]}],
                 "education": [{"institution": "COEP", "degree": "B.E.", "grade": "8.6"}],
                 "skills": [{"name": "Backend", "items": ["Java"]}],
                 "projects": [{"name": "CareerPilot", "technologies": ["Spring"], "url": "github.com/raj/cp"}],
                 "certifications": [{"name": "AZ-204", "issuer": "Microsoft", "date": "2024"}],
                 "languages": [{"name": "English", "proficiency": "Native"}]}
                """).normalized();

        assertThat(data.sections()).extracting(Section::title)
                .containsExactly("Summary", "Experience", "Projects", "Education", "Skills", "Certifications", "Languages");
        assertThat(data.sections().get(1).entries().getFirst()).satisfies(e -> {
            assertThat(e.title()).isEqualTo("Dev");
            assertThat(e.subtitle()).isEqualTo("CRED");
            assertThat(e.current()).isTrue();
            assertThat(e.bullets()).containsExactly("Built it");
        });
        assertThat(data.sections().get(2).entries().getFirst().subtitle()).isEqualTo("Spring");
        assertThat(data.sections().get(3).entries().getFirst().title()).isEqualTo("B.E.");
        assertThat(data.sections().get(6).items().getFirst().text()).isEqualTo("English (Native)");
        assertThat(validator.validate(data)).isEmpty();
    }

    @Test
    void safeUrlRules() {
        assertThat(SafeUrls.webLink("github.com/raj")).contains("https://github.com/raj");
        assertThat(SafeUrls.webLink("http://example.com/a?b=c")).contains("http://example.com/a?b=c");
        assertThat(SafeUrls.webLink("javascript:alert(1)")).isEmpty();
        assertThat(SafeUrls.webLink("JAVASCRIPT:alert(1)")).isEmpty();
        assertThat(SafeUrls.webLink("vbscript:x")).isEmpty();
        assertThat(SafeUrls.webLink("ftp://example.com")).isEmpty();
        assertThat(SafeUrls.webLink("https://exa mple.com")).isEmpty();
        assertThat(SafeUrls.webLink("https://example.com\n.evil")).isEmpty();
        assertThat(SafeUrls.webLink("//evil.example.com")).isEmpty();
        assertThat(SafeUrls.webLink("https://" + "a".repeat(600) + ".com")).isEmpty();
    }

    private Set<String> paths(ResumeData data) {
        Set<ConstraintViolation<ResumeData>> violations = validator.validate(data);
        return violations.stream().map(v -> v.getPropertyPath().toString()
                .replaceAll("\\.<list element>", "").replaceAll("<list element>", ""))
                .collect(Collectors.toSet());
    }

}
