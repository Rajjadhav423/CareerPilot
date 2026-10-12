package com.careerpilot.backend.resume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.document.DocumentProperties;
import com.careerpilot.backend.document.HtmlDocumentRenderer;
import com.careerpilot.backend.document.PageSize;
import com.careerpilot.backend.document.PdfDocumentConverter;
import com.careerpilot.backend.resume.ResumeData.Basics;
import com.careerpilot.backend.resume.ResumeData.Entry;
import com.careerpilot.backend.resume.ResumeData.Link;
import com.careerpilot.backend.resume.ResumeData.ListItem;
import com.careerpilot.backend.resume.ResumeData.Section;
import com.careerpilot.backend.resume.ResumeData.SectionType;
import com.careerpilot.backend.resume.ResumeData.SkillGroup;
import com.sun.net.httpserver.HttpServer;

class ResumeDocumentServiceTest {

    private final PdfDocumentConverter converter = converter(10);
    private final ResumeDocumentService service =
            new ResumeDocumentService(new ResumeTemplates(), new HtmlDocumentRenderer(), converter);

    @Test
    void createsAPdfWithRealSelectableTextForEveryTemplate() throws IOException {
        for (String template : List.of("classic", "modern")) {
            var pdf = service.renderPdf(template, PageSize.A4, sample());

            assertThat(pdf.pages()).isEqualTo(1);
            try (PDDocument document = Loader.loadPDF(pdf.bytes())) {
                String text = new PDFTextStripper().getText(document);
                assertThat(text).contains("Raj Jadhav", "Backend Engineer", "CRED", "Software Engineer",
                        "Built payment reconciliation in Java", "Java, Spring Boot, PostgreSQL");
                assertThat(text).containsIgnoringCase("Experience").containsIgnoringCase("Education").containsIgnoringCase("Skills");
                // No ligature glyphs: words with fi/fl/ft extract exactly (ATS and copy-paste)
                assertThat(text).doesNotContain("So ware");
                assertThat(document.getDocumentInformation().getTitle()).isEqualTo("Raj Jadhav — Resume");
                assertThat(document.getDocumentInformation().getAuthor()).isEqualTo("Raj Jadhav");
                for (var name : document.getPage(0).getResources().getFontNames()) {
                    assertThat(document.getPage(0).getResources().getFont(name).isEmbedded()).isTrue();
                }
            }
        }
    }

    @Test
    void sectionsAreFreeFormAndPrintedInTheChosenOrder() throws IOException {
        ResumeData data = resume(
                text("about", "About Me", "Researcher turned engineer."),
                list("awards", "Awards & Honours", "Best Paper, ICSE 2024", "Dean's list"),
                entries("research", "Research", new Entry(null, "Graph databases", "IISc Bengaluru", null, "2023", null,
                        true, null, null, List.of("Published two papers"), null)),
                skills("tools", "Toolbox", new SkillGroup(null, null, List.of("Git", "Docker"), null)));

        String html = service.renderHtml("modern", PageSize.A4, data);

        assertThat(html.indexOf(">About Me<")).isLessThan(html.indexOf(">Awards &amp; Honours<"));
        assertThat(html.indexOf(">Awards &amp; Honours<")).isLessThan(html.indexOf(">Research<"));
        assertThat(html.indexOf(">Research<")).isLessThan(html.indexOf(">Toolbox<"));
        try (PDDocument document = Loader.loadPDF(service.renderPdf("modern", PageSize.A4, data).bytes())) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).containsIgnoringCase("Awards & Honours").contains("Best Paper, ICSE 2024", "Git, Docker",
                    "Graph databases", "2023 – Present");
        }
    }

    @Test
    void hiddenSectionsAndItemsAreLeftOut() {
        ResumeData data = resume(
                new Section("secret", SectionType.text, "Hidden Section", false, null, "Do not print", null, null),
                entries("exp", "Experience",
                        new Entry(null, "Shown job", null, null, null, null, false, null, null, null, null),
                        new Entry(null, "Hidden job", null, null, null, null, false, null, null, null, false)),
                entries("empty", "Empty Section"));

        String html = service.renderHtml("classic", PageSize.A4, data);

        assertThat(html).contains("Shown job").doesNotContain("Hidden Section", "Do not print", "Hidden job", "Empty Section");
    }

    @Test
    void formattingIsAppliedButHtmlAndScriptsStayPlainText() throws IOException {
        ResumeData data = new ResumeData(2,
                new Basics("<script>alert('x')</script>Raj", "<b>Engineer</b>", null, null, "Pune & Mumbai", List.of()),
                List.of(text("t", "Summary", "Loves **reliable systems**, *clean code* and [my blog](https://raj.dev). "
                        + "<img src=x onerror=alert(1)> [bad](javascript:alert(1))")));

        String html = service.renderHtml("classic", PageSize.A4, data);
        assertThat(html).doesNotContain("<script>", "<img", "<b>", "javascript:")
                .contains("&lt;script&gt;", "&lt;b&gt;Engineer&lt;/b&gt;", "Pune &amp; Mumbai",
                        "<strong>reliable systems</strong>", "<em>clean code</em>", "<a href=\"https://raj.dev\">my blog</a>",
                        "&lt;img src=x onerror=alert(1)&gt;", "bad");

        try (PDDocument document = Loader.loadPDF(service.renderPdf("classic", PageSize.A4, data).bytes())) {
            assertThat(new PDFTextStripper().getText(document)).contains("<script>alert('x')</script>Raj",
                    "<img src=x onerror=alert(1)>", "reliable systems");
            assertThat(linkTargets(document)).contains("https://raj.dev").noneMatch(t -> t.startsWith("javascript"));
        }
    }

    @Test
    void onlySafeLinksBecomeClickable() throws IOException {
        // Bypasses bean validation on purpose: the view must still refuse unsafe schemes
        ResumeData data = new ResumeData(2,
                new Basics("Raj Jadhav", null, "raj@example.com", null, null, List.of(
                        new Link("GitHub", "github.com/raj"),
                        new Link("Evil", "javascript:alert(1)"),
                        new Link("File", "file:///etc/passwd"),
                        new Link("Data", "data:text/html,<script>1</script>"),
                        new Link("Creds", "https://user:pass@example.com"))),
                List.of());

        String html = service.renderHtml("modern", PageSize.A4, data);
        assertThat(html).contains("href=\"https://github.com/raj\"", "href=\"mailto:raj@example.com\"")
                .doesNotContain("javascript:", "file:", "data:text", "user:pass");

        try (PDDocument document = Loader.loadPDF(service.renderPdf("modern", PageSize.A4, data).bytes())) {
            assertThat(linkTargets(document)).containsExactlyInAnyOrder("https://github.com/raj", "mailto:raj@example.com");
        }
    }

    @Test
    void longResumesFlowOntoMorePagesWithoutStrandingSectionHeadings() throws IOException {
        Entry[] jobs = IntStream.range(0, 12).mapToObj(i -> new Entry(null, "Engineer " + i, "Company " + i, "Pune",
                "Jan 20" + (10 + i), "Dec 20" + (10 + i), false, null, null,
                List.of("Delivered a long-running project with measurable results across several teams and quarters " + i,
                        "Mentored engineers, improved reliability, and reduced cloud costs significantly " + i,
                        "Designed APIs and data models used by millions of requests every single day " + i), null))
                .toArray(Entry[]::new);
        ResumeData data = resume(entries("exp", "Experience", jobs),
                entries("edu", "Education", new Entry(null, "B.E., Computer Engineering", "University of Pune", null,
                        "2010", "2014", false, null, null, null, null)));

        var pdf = service.renderPdf("classic", PageSize.A4, data);

        assertThat(pdf.pages()).isGreaterThan(1);
        try (PDDocument document = Loader.loadPDF(pdf.bytes())) {
            int headingPage = pageContaining(document, "EDUCATION");
            assertThat(headingPage).isPositive();
            assertThat(pageText(document, headingPage)).contains("University of Pune");
            assertThat(pageText(document, 1)).contains("Page 1 of " + pdf.pages());
        }
    }

    @Test
    void onlyANameIsNeeded() throws IOException {
        ResumeData data = new ResumeData(null, new Basics("Raj Jadhav", null, null, null, null, null), null);

        String html = service.renderHtml("classic", PageSize.A4, data);
        assertThat(html).doesNotContain("class=\"section-title\"");
        try (PDDocument document = Loader.loadPDF(service.renderPdf("classic", PageSize.A4, data).bytes())) {
            assertThat(document.getNumberOfPages()).isEqualTo(1);
            assertThat(new PDFTextStripper().getText(document)).contains("Raj Jadhav");
        }
    }

    @Test
    void unprintableCharactersAndHugeWordsDoNotBreakRendering() throws IOException {
        ResumeData data = new ResumeData(2, new Basics("Raj\u0000 Jadhav\u0007", null, null, null, null, List.of()),
                List.of(text("t", "Summary", "Summary with a form feed\f and " + "x".repeat(450))));

        try (PDDocument document = Loader.loadPDF(service.renderPdf("modern", PageSize.A4, data).bytes())) {
            assertThat(new PDFTextStripper().getText(document)).contains("Raj Jadhav");
        }
    }

    @Test
    void letterPaperIsSupported() throws IOException {
        try (PDDocument document = Loader.loadPDF(service.renderPdf("classic", PageSize.LETTER, sample()).bytes())) {
            PDPage page = document.getPage(0);
            assertThat(page.getMediaBox().getWidth()).isCloseTo(612f, org.assertj.core.data.Offset.offset(1f));
            assertThat(page.getMediaBox().getHeight()).isCloseTo(792f, org.assertj.core.data.Offset.offset(1f));
        }
    }

    @Test
    void pageMarginsComeFromTheLayout() throws IOException {
        ResumeData base = sample();
        ResumeData wide = new ResumeData(2, base.basics(), base.sections(), new ResumeData.Layout(8.0, null, null, 35.0));

        assertThat(service.renderHtml("classic", PageSize.A4, wide)).contains("@page { margin: 8.0mm 16.0mm 16.0mm 35.0mm; }");
        assertThat(service.renderHtml("classic", PageSize.A4, base)).doesNotContain("8.0mm");
        // 35 mm ≈ 99 pt from the left edge instead of 16 mm ≈ 45 pt
        assertThat(leftmostText(service.renderPdf("classic", PageSize.A4, wide).bytes())).isGreaterThan(95f);
        assertThat(leftmostText(service.renderPdf("classic", PageSize.A4, base).bytes())).isLessThan(60f);
    }

    @Test
    void previewPagesAreImagesOfEachPdfPage() throws IOException {
        List<byte[]> pages = service.renderPageImages("modern", PageSize.A4, sample());

        assertThat(pages).hasSize(1);
        var image = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(pages.get(0)));
        // A4 at 120 dpi
        assertThat(image.getWidth()).isBetween(985, 995);
        assertThat(image.getHeight()).isBetween(1398, 1408);
    }

    private static float leftmostText(byte[] pdf) throws IOException {
        float[] min = {Float.MAX_VALUE};
        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper() {
                @Override
                protected void writeString(String text, List<org.apache.pdfbox.text.TextPosition> positions) {
                    positions.forEach(p -> min[0] = Math.min(min[0], p.getXDirAdj()));
                }
            };
            stripper.getText(document);
        }
        return min[0];
    }

    @Test
    void documentsOverThePageLimitAreRefused() {
        ResumeDocumentService strict = new ResumeDocumentService(new ResumeTemplates(), new HtmlDocumentRenderer(), converter(1));
        List<Entry> jobs = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            jobs.add(new Entry(null, "Engineer " + i, "Company", null, null, null, false, null, null,
                    Collections.nCopies(6, "A fairly long highlight sentence that takes up most of a printed line."), null));
        }
        ResumeData data = resume(entries("exp", "Experience", jobs.toArray(Entry[]::new)));

        assertThatThrownBy(() -> strict.renderPdf("classic", PageSize.A4, data))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("DOCUMENT_TOO_LONG");
    }

    @Test
    void unknownTemplatesAreRejected() {
        assertThatThrownBy(() -> service.renderHtml("../../etc/passwd", PageSize.A4, sample()))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("UNKNOWN_TEMPLATE");
    }

    @Test
    void theRendererNeverFetchesExternalResources() throws IOException {
        AtomicInteger hits = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            hits.incrementAndGet();
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            String hostile = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>t</title>
                    <link rel="stylesheet" href="%1$s/style.css"/>
                    <style>@import url("%1$s/import.css"); @font-face { font-family: X; src: url("%1$s/font.ttf"); }
                    body { background-image: url("%1$s/bg.png"); font-family: X; }</style></head>
                    <body><img src="%1$s/image.png" alt="x"/><img src="file:///C:/Windows/win.ini" alt="y"/>
                    <object data="%1$s/embed.pdf"></object><p>Hello</p></body></html>
                    """.formatted(base);

            var pdf = converter.convert(hostile);

            assertThat(pdf.pages()).isEqualTo(1);
            assertThat(hits).hasValue(0);
        } finally {
            server.stop(0);
        }
    }

    static ResumeData sample() {
        return new ResumeData(2,
                new Basics("Raj Jadhav", "Backend Engineer", "raj@example.com", "+91 98765 43210", "Pune, India",
                        List.of(new Link("GitHub", "https://github.com/raj"))),
                List.of(
                        text("summary", "Summary", "Backend engineer focused on payments and reliability."),
                        entries("experience", "Experience", new Entry(null, "Software Engineer", "CRED", "Bengaluru",
                                "Jan 2022", null, true, null, null,
                                List.of("Built payment reconciliation in Java", "Cut API latency by 40%"), null)),
                        entries("education", "Education", new Entry(null, "B.E., Computer Engineering", "University of Pune",
                                null, "2016", "2020", false, null, "8.6 CGPA", null, null)),
                        skills("skills", "Skills", new SkillGroup(null, "Backend", List.of("Java", "Spring Boot", "PostgreSQL"), null))));
    }

    static ResumeData resume(Section... sections) {
        return new ResumeData(2, new Basics("Raj Jadhav", null, null, null, null, List.of()), List.of(sections));
    }

    static Section text(String id, String title, String content) {
        return new Section(id, SectionType.text, title, null, null, content, null, null);
    }

    static Section entries(String id, String title, Entry... entries) {
        return new Section(id, SectionType.entries, title, null, List.of(entries), null, null, null);
    }

    static Section list(String id, String title, String... items) {
        return new Section(id, SectionType.list, title, null, null, null,
                java.util.Arrays.stream(items).map(t -> new ListItem(null, t, null)).toList(), null);
    }

    static Section skills(String id, String title, SkillGroup... groups) {
        return new Section(id, SectionType.skills, title, null, null, null, null, List.of(groups));
    }

    private static PdfDocumentConverter converter(int maxPages) {
        return new PdfDocumentConverter(new DocumentProperties(maxPages, DataSize.ofMegabytes(5), Duration.ofSeconds(60), 2, 8));
    }

    private static List<String> linkTargets(PDDocument document) throws IOException {
        List<String> targets = new ArrayList<>();
        for (PDPage page : document.getPages()) {
            for (PDAnnotation annotation : page.getAnnotations()) {
                if (annotation instanceof PDAnnotationLink link && link.getAction() instanceof PDActionURI uri) {
                    targets.add(uri.getURI());
                }
            }
        }
        return targets;
    }

    private static int pageContaining(PDDocument document, String needle) throws IOException {
        for (int page = 1; page <= document.getNumberOfPages(); page++) {
            if (pageText(document, page).contains(needle)) {
                return page;
            }
        }
        return -1;
    }

    private static String pageText(PDDocument document, int page) throws IOException {
        PDFTextStripper stripper = new PDFTextStripper();
        stripper.setStartPage(page);
        stripper.setEndPage(page);
        return stripper.getText(document);
    }
}
