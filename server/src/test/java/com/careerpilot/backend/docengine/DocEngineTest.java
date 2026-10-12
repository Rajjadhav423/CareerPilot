package com.careerpilot.backend.docengine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.docengine.DocModel.Doc;
import com.careerpilot.backend.docengine.DocReader.Issue;
import com.careerpilot.backend.docengine.DocReader.Mode;
import com.careerpilot.backend.docengine.DocReader.Result;

class DocEngineTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final PdfDocumentConverter CONVERTER = new PdfDocumentConverter(
            new DocumentProperties(10, DataSize.ofMegabytes(5), Duration.ofSeconds(30), 2, 8));
    private static final DocPresets PRESETS = new DocPresets(JSON);
    private final DocEngine engine = new DocEngine(PRESETS, CONVERTER);

    // ---- the rules file and the code agree ----

    @Test
    void everyCompleteExampleInTheRulesFileIsValidAndRenders() throws IOException {
        Matcher blocks = Pattern.compile("```json\\n(\\{\\n  \"schemaVersion\": 3[\\s\\S]*?)\\n```").matcher(engine.rules());
        int examples = 0;
        while (blocks.find()) {
            examples++;
            Result result = engine.read(JSON.readTree(blocks.group(1)), Mode.STRICT);
            assertThat(result.errors()).as("example %d", examples).isEmpty();
            assertThat(result.warnings()).as("example %d", examples).isEmpty();
            assertThat(engine.toPdf(result.doc()).pages()).isEqualTo(1);
        }
        assertThat(examples).isEqualTo(3);
    }

    @Test
    void presetsAreValidDocumentStyles() {
        assertThat(PRESETS.all()).extracting(DocPresets.Preset::id).containsExactly("classic", "modern");
        assertThat(PRESETS.find("classic").orElseThrow().styles()).containsKey(".section-title");
    }

    // ---- rendering ----

    @Test
    void rendersRealTextWithTheDocumentsStylesAndMetadata() throws IOException {
        Doc doc = valid("""
                {"schemaVersion": 3, "document": "resume",
                 "meta": {"title": "Raj — Resume", "author": "Raj Jadhav"},
                 "styles": {"h1": {"font-size": "24pt"}, ".muted": {"color": "#44474f"}},
                 "sections": [{"id": "s1", "nodes": [
                   {"tag": "h1", "text": "Raj Jadhav"},
                   {"tag": "p", "class": "muted", "html": "Built <b>payments</b> at <a href='https://cred.club'>CRED</a>"},
                   {"tag": "ul", "children": [{"tag": "li", "text": "Software engineer"}]},
                   {"tag": "table", "children": [{"tag": "tr", "children": [
                     {"tag": "td", "text": "Left"}, {"tag": "td", "attrs": {"colspan": "2"}, "text": "Right"}]}]}
                 ]}]}
                """);
        String html = engine.toXhtml(doc);
        assertThat(html).contains("h1 { font-size: 24pt; }", ".muted { color: #44474f; }",
                "<p class=\"muted\">Built <b>payments</b> at <a href=\"https://cred.club\" title=\"CRED\">CRED</a></p>",
                "<td colspan=\"2\">Right</td>", "<section id=\"s1\" class=\"section\">");

        try (PDDocument pdf = Loader.loadPDF(engine.toPdf(doc).bytes())) {
            // Reading order by position: bold runs are drawn after the line's regular text in the content stream
            PDFTextStripper sorted = new PDFTextStripper();
            sorted.setSortByPosition(true);
            String text = sorted.getText(pdf);
            assertThat(text).contains("Raj Jadhav", "Built payments at CRED", "Software engineer", "Left", "Right", "Page 1 of 1");
            assertThat(pdf.getDocumentInformation().getTitle()).isEqualTo("Raj — Resume");
            assertThat(pdf.getDocumentInformation().getAuthor()).isEqualTo("Raj Jadhav");
        }
    }

    @Test
    void aNodesOwnStyleOverridesClassAndTagStyles() throws IOException {
        Doc doc = valid("""
                {"schemaVersion": 3, "document": "resume",
                 "styles": {"p": {"font-size": "8pt"}, ".big": {"font-size": "12pt"}},
                 "sections": [{"id": "s", "nodes": [
                   {"tag": "p", "text": "TagSized"},
                   {"tag": "p", "class": "big", "text": "ClassSized"},
                   {"tag": "p", "class": "big", "style": {"font-size": "20pt"}, "text": "InlineSized"}
                 ]}]}
                """);
        byte[] pdf = engine.toPdf(doc).bytes();
        float tag = fontSize(pdf, "TagSized");
        float byClass = fontSize(pdf, "ClassSized");
        float inline = fontSize(pdf, "InlineSized");
        // 8pt < 12pt < 20pt (PDFBox reports rounded sizes, so compare ratios)
        assertThat(byClass / tag).isBetween(1.3f, 1.9f);
        assertThat(inline / byClass).isBetween(1.4f, 1.9f);
    }

    @Test
    void pageMarginsAndPageNumbersComeFromPage() throws IOException {
        Doc doc = valid("""
                {"schemaVersion": 3, "document": "coverLetter",
                 "page": {"size": "letter", "margin": "10mm 30mm", "pageNumbers": false},
                 "sections": [{"id": "s", "nodes": [{"tag": "p", "text": "Dear Hiring Manager,"}]}]}
                """);
        assertThat(doc.page().margin()).isEqualTo("10mm 30mm 10mm 30mm");
        try (PDDocument pdf = Loader.loadPDF(engine.toPdf(doc).bytes())) {
            assertThat(pdf.getPage(0).getMediaBox().getWidth()).isCloseTo(612f, org.assertj.core.data.Offset.offset(1f));
            assertThat(new PDFTextStripper().getText(pdf)).doesNotContain("Page 1");
            // 30 mm ≈ 85 pt from the left edge
            assertThat(leftmost(pdf)).isBetween(83f, 90f);
        }
    }

    @Test
    void documentsLongerThanMaxPagesAreRefused() {
        StringBuilder nodes = new StringBuilder();
        for (int i = 0; i < 80; i++) {
            nodes.append(i == 0 ? "" : ",").append("{\"tag\": \"p\", \"text\": \"Line ").append(i).append("\"}");
        }
        Doc doc = valid("{\"schemaVersion\": 3, \"document\": \"resume\", \"page\": {\"maxPages\": 1},"
                + " \"styles\": {\"p\": {\"font-size\": \"14pt\"}}, \"sections\": [{\"id\": \"s\", \"nodes\": [" + nodes + "]}]}");
        assertThatThrownBy(() -> engine.toPdf(doc)).isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("DOCUMENT_TOO_LONG");
    }

    @Test
    void textIsAlwaysEscaped() {
        Doc doc = valid("""
                {"schemaVersion": 3, "document": "resume", "sections": [{"id": "s", "nodes": [
                  {"tag": "p", "text": "</p></section><script>alert(1)</script> & \\"quotes\\""},
                  {"tag": "p", "attrs": {"lang": "en"}, "html": "<b onclick='x'>bold</b> &lt;i&gt;"}
                ]}]}
                """, Mode.LENIENT);
        String html = engine.toXhtml(doc);
        assertThat(html).contains("&lt;/p&gt;&lt;/section&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; \"quotes\"",
                "<b>bold</b> &lt;i&gt;").doesNotContain("<script", "onclick");
    }

    // ---- strict rules ----

    @Test
    void dangerousTagsAttributesAndLinksAreRejected() {
        List<Issue> errors = errors("""
                {"schemaVersion": 3, "document": "resume", "sections": [{"id": "s", "nodes": [
                  {"tag": "script", "text": "alert(1)"},
                  {"tag": "img", "attrs": {"src": "http://169.254.169.254/latest"}},
                  {"tag": "a", "attrs": {"href": "javascript:alert(1)"}, "text": "x"},
                  {"tag": "p", "attrs": {"onclick": "alert(1)", "style": "color:red"}, "text": "x"},
                  {"tag": "p", "html": "<script>x</script><iframe src='https://evil'></iframe><a href='data:text/html,x'>y</a>"}
                ]}]}
                """);
        assertThat(errors).extracting(Issue::code).contains("TAG_BLOCKED", "UNSAFE_LINK", "ATTR_BLOCKED",
                "ATTR_NOT_ALLOWED", "INLINE_TAG_NOT_ALLOWED");
        assertThat(errors).extracting(Issue::path).contains("/sections/0/nodes/0/tag", "/sections/0/nodes/2/attrs/href",
                "/sections/0/nodes/3/attrs/onclick", "/sections/0/nodes/4/html");
    }

    @Test
    void phoneLinksAreAllowedAndNormalized() {
        Doc doc = valid("""
                {"schemaVersion": 3, "document": "resume", "sections": [{"id": "s", "nodes": [
                  {"tag": "a", "attrs": {"href": "tel:+91 93228-50587"}, "text": "+91 93228 50587"},
                  {"tag": "p", "html": "Call <a href='tel:(022) 555-0100'>me</a>"}
                ]}]}
                """);
        assertThat(engine.toXhtml(doc)).contains("href=\"tel:+919322850587\"", "href=\"tel:0225550100\"");
        assertThat(errors("""
                {"schemaVersion": 3, "document": "resume", "sections": [{"id": "s", "nodes": [
                  {"tag": "a", "attrs": {"href": "tel:call-me;javascript:alert(1)"}, "text": "x"}]}]}
                """)).extracting(Issue::code).contains("UNSAFE_LINK");
    }

    @Test
    void nodesWithoutATagAreRemovedInLenientMode() {
        String json = """
                {"schemaVersion": 3, "document": "resume", "sections": [{"id": "s", "nodes": [
                  {"tag": "p", "text": "kept"}, {"p": "unused"}]}]}
                """;
        assertThat(errors(json)).extracting(Issue::code).contains("TAG_MISSING", "UNKNOWN_FIELD");
        Doc repaired = valid(json, Mode.LENIENT);
        assertThat(repaired.sections().get(0).nodes()).hasSize(1);
    }

    @Test
    void cssIsCheckedPropertyByProperty() {
        List<Issue> errors = errors("""
                {"schemaVersion": 3, "document": "resume",
                 "styles": {"div p": {"color": "red"}, "body": {"font-family": "Comic Sans MS"}},
                 "sections": [{"id": "s", "nodes": [{"tag": "div", "style": {
                   "display": "flex", "background": "url(https://evil/x.png)", "position": "absolute",
                   "color": "expression(alert(1))", "font-size": "200pt", "letter-spacing": "2pt", "margin": "1px; } body { x"
                 }, "text": "x"}]}]}
                """);
        assertThat(errors).extracting(Issue::code).contains("SELECTOR_INVALID", "CSS_FONT_UNAVAILABLE",
                "CSS_LAYOUT_UNSUPPORTED", "CSS_PROPERTY_BLOCKED", "CSS_VALUE_BLOCKED", "CSS_VALUE_INVALID");
        assertThat(errors).extracting(Issue::path).contains("/sections/0/nodes/0/style/display",
                "/sections/0/nodes/0/style/font-size", "/styles/div p");
    }

    @Test
    void structureRulesAreEnforced() {
        List<Issue> errors = errors("""
                {"schemaVersion": 3, "document": "resume", "extra": 1, "sections": [
                  {"id": "dup", "nodes": [
                    {"tag": "li", "text": "orphan item"},
                    {"tag": "p", "children": [{"tag": "div", "text": "block in inline"}]},
                    {"tag": "ul", "text": "text in a list"},
                    {"tag": "p", "text": "a", "html": "b"},
                    {"id": "dup", "tag": "p", "text": "duplicate id"},
                    {"tag": "a", "text": "no href"},
                    {"tag": "p", "role": "boss", "data": {"start": "Jan 2022"}, "text": "x"}
                  ]}]}
                """);
        assertThat(errors).extracting(Issue::code).contains("UNKNOWN_FIELD", "TAG_WRONG_PARENT", "BLOCK_IN_INLINE",
                "CONTENT_NOT_ALLOWED", "CONTENT_CONFLICT", "ID_DUPLICATE", "LINK_MISSING_HREF", "ROLE_UNKNOWN", "DATA_DATE_FORMAT");
    }

    @Test
    void missingBasicsAreReported() {
        assertThat(errors("{}")).extracting(Issue::code).contains("SCHEMA_VERSION", "DOCUMENT_KIND", "MISSING_SECTIONS");
        assertThat(engine.read(JSON.readTree("[1, 2]"), Mode.STRICT).errors()).extracting(Issue::code).containsExactly("NOT_AN_OBJECT");
    }

    @Test
    void undefinedClassesAndLowContrastAreOnlyWarnings() {
        Result result = engine.read(JSON.readTree("""
                {"schemaVersion": 3, "document": "resume", "styles": {".faint": {"color": "#cccccc"}},
                 "sections": [{"id": "s", "nodes": [{"tag": "p", "class": "faint nowhere", "text": "x"}]}]}
                """), Mode.STRICT);
        assertThat(result.valid()).isTrue();
        assertThat(result.warnings()).extracting(Issue::code).containsExactlyInAnyOrder("LOW_CONTRAST", "CLASS_UNDEFINED");
    }

    // ---- lenient repair ----

    @Test
    void lenientModeRepairsAndTheResultIsStrictlyValid() {
        Result lenient = engine.read(JSON.readTree("""
                {"document": "resume", "junk": true, "sections": [{"nodes": [
                  {"tag": "script", "text": "alert(1)"},
                  {"tag": "article2", "text": "unknown tag"},
                  {"tag": "li", "text": "orphan"},
                  {"tag": "ul", "children": [{"tag": "p", "text": "becomes an item"}]},
                  {"tag": "p", "style": {"display": "flex", "color": "#1f2328"}, "html": "<div>x</div><b style='x'>y</b>"},
                  {"tag": "a", "attrs": {"href": "javascript:1"}, "text": "z"}
                ]}]}
                """), Mode.LENIENT);
        assertThat(lenient.valid()).isTrue();
        assertThat(lenient.warnings()).isNotEmpty();

        JsonNode repaired = engine.toJson(lenient.doc());
        Result strict = engine.read(repaired, Mode.STRICT);
        assertThat(strict.errors()).isEmpty();
        String html = engine.toXhtml(strict.doc());
        assertThat(html).doesNotContain("<script", "alert(1)", "flex", "javascript").contains("becomes an item", "<b>y</b>");
    }

    // ---- helpers ----

    private Doc valid(String json) {
        return valid(json, Mode.STRICT);
    }

    private Doc valid(String json, Mode mode) {
        Result result = engine.read(JSON.readTree(json), mode);
        assertThat(result.errors()).isEmpty();
        return result.doc();
    }

    private List<Issue> errors(String json) {
        Result result = engine.read(JSON.readTree(json), Mode.STRICT);
        assertThat(result.valid()).isFalse();
        return result.errors();
    }

    private static float fontSize(byte[] pdf, String word) throws IOException {
        List<Float> sizes = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper() {
                @Override
                protected void writeString(String text, List<TextPosition> positions) {
                    if (text.contains(word)) {
                        sizes.add(positions.get(0).getFontSizeInPt());
                    }
                }
            };
            stripper.getText(document);
        }
        assertThat(sizes).as("text %s", word).isNotEmpty();
        return sizes.get(0);
    }

    private static float leftmost(PDDocument document) throws IOException {
        float[] min = {Float.MAX_VALUE};
        PDFTextStripper stripper = new PDFTextStripper() {
            @Override
            protected void writeString(String text, List<TextPosition> positions) {
                positions.forEach(p -> min[0] = Math.min(min[0], p.getXDirAdj()));
            }
        };
        stripper.getText(document);
        return min[0];
    }
}
