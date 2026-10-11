package com.careerpilot.backend.resume;

import static com.careerpilot.backend.resume.ResumeDocumentServiceTest.entries;
import static com.careerpilot.backend.resume.ResumeDocumentServiceTest.list;
import static com.careerpilot.backend.resume.ResumeDocumentServiceTest.resume;
import static com.careerpilot.backend.resume.ResumeDocumentServiceTest.text;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.careerpilot.backend.resume.ResumeData.Entry;
import com.careerpilot.backend.resume.ResumeData.Section;
import com.careerpilot.backend.resume.ResumeData.SectionType;

class RichTextAndDiffTest {

    @Test
    void supportsBoldItalicAndSafeLinksOnly() {
        assertThat(RichText.toXhtml("**Led** a *team* of _five_ at [CRED](https://cred.club)"))
                .isEqualTo("<strong>Led</strong> a <em>team</em> of <em>five</em> at <a href=\"https://cred.club\">CRED</a>");
        assertThat(RichText.toXhtml("[click](javascript:alert(1))")).isEqualTo("click");
        assertThat(RichText.toXhtml("[Java](https://en.wikipedia.org/wiki/Java_(programming_language))"))
                .isEqualTo("<a href=\"https://en.wikipedia.org/wiki/Java_(programming_language)\">Java</a>");
        assertThat(RichText.toXhtml("[x](data:text/html,<b>)")).isEqualTo("x");
        assertThat(RichText.toXhtml("<b onclick=\"x\">&</b>")).isEqualTo("&lt;b onclick=&quot;x&quot;&gt;&amp;&lt;/b&gt;");
        assertThat(RichText.toXhtml("**<script>**")).isEqualTo("<strong>&lt;script&gt;</strong>");
        assertThat(RichText.toXhtml("[a\" onmouseover=\"x](https://ok.example)"))
                .isEqualTo("<a href=\"https://ok.example\">a&quot; onmouseover=&quot;x</a>");
    }

    @Test
    void unmatchedOrEscapedMarkersArePrintedLiterally() {
        assertThat(RichText.toXhtml("2 * 3 = 6")).isEqualTo("2 * 3 = 6");
        assertThat(RichText.toXhtml("**not closed")).isEqualTo("**not closed");
        assertThat(RichText.toXhtml("\\*literal\\*")).isEqualTo("*literal*");
        assertThat(RichText.toXhtml("snake_case_name")).isEqualTo("snake_case_name");
        assertThat(RichText.toXhtml("[no link]")).isEqualTo("[no link]");
        assertThat(RichText.toPlain("**Led** [CRED](https://cred.club) & co")).isEqualTo("Led CRED & co");
    }

    @Test
    void paragraphsSplitOnBlankLines() {
        assertThat(RichText.paragraphs("First line\ncontinues\n\nSecond **para**"))
                .containsExactly("First line continues", "Second <strong>para</strong>");
    }

    @Test
    void diffDescribesChangesByIdInReviewableTerms() {
        ResumeData before = resume(
                text("summary", "Summary", "Backend engineer."),
                entries("exp", "Experience", new Entry("cred", "Engineer", "CRED", null, null, null, false, null, null,
                        List.of("Built payments"), null)),
                list("awards", "Awards", "Hackathon winner"));
        ResumeData after = resume(
                entries("exp", "Work Experience", new Entry("cred", "Senior Engineer", "CRED", null, null, null, false, null,
                        null, List.of("Built **payments** at scale"), null),
                        new Entry("new", "Intern", "Druva", null, null, null, false, null, null, null, null)),
                text("summary", "Summary", "Backend engineer focused on payments."),
                new Section("courses", SectionType.list, "Relevant Coursework", null, null, null,
                        List.of(new ResumeData.ListItem(null, "Distributed systems", null)), null));

        List<ResumeDiff.Change> changes = ResumeDiff.between(before, after);

        assertThat(changes).anySatisfy(c -> {
            assertThat(c.kind()).isEqualTo("CHANGED");
            assertThat(c.field()).isEqualTo("title");
            assertThat(c.before()).isEqualTo("Experience");
            assertThat(c.after()).isEqualTo("Work Experience");
        });
        assertThat(changes).anySatisfy(c -> {
            assertThat(c.where()).isEqualTo("Work Experience › Senior Engineer");
            assertThat(c.field()).isEqualTo("bullets");
            assertThat(c.after()).isEqualTo("Built payments at scale");
        });
        assertThat(changes).anySatisfy(c -> assertThat(c.kind() + " " + c.where()).isEqualTo("ADDED Work Experience › Intern"));
        assertThat(changes).anySatisfy(c -> assertThat(c.kind() + " " + c.where()).isEqualTo("ADDED Relevant Coursework"));
        assertThat(changes).anySatisfy(c -> assertThat(c.kind() + " " + c.where()).isEqualTo("REMOVED Awards"));
        assertThat(changes).anySatisfy(c -> assertThat(c.kind() + " " + c.where()).isEqualTo("MOVED Section order"));
        assertThat(changes).anySatisfy(c -> assertThat(c.field()).isEqualTo("text"));
    }

    @Test
    void identicalResumesHaveNoChanges() {
        assertThat(ResumeDiff.between(ResumeDocumentServiceTest.sample(), ResumeDocumentServiceTest.sample())).isEmpty();
    }
}
