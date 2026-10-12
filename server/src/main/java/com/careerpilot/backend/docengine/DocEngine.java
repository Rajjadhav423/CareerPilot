package com.careerpilot.backend.docengine;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.docengine.DocModel.Doc;
import com.careerpilot.backend.docengine.DocReader.Issue;
import com.careerpilot.backend.docengine.DocReader.Mode;
import com.careerpilot.backend.docengine.PdfDocumentConverter.RenderedPdf;

/**
 * docEngine: document JSON → validated {@link Doc} → XHTML → PDF (and page images for previews).
 * The rules are in {@code docengine/spec/doc-rules.md}, served at {@code GET /api/v1/docs/rules} so people and
 * AI assistants (MCP) can write valid documents.
 */
@Component
public class DocEngine {

    private final DocPresets presets;
    private final PdfDocumentConverter pdf;
    private final String rules;

    private static final Logger log = LoggerFactory.getLogger(DocEngine.class);

    public DocEngine(DocPresets presets, PdfDocumentConverter pdf) {
        this.presets = presets;
        this.pdf = pdf;
        this.rules = readRules();
    }

    /**
     * Renders one small document in the background after startup, so fonts are parsed and the rendering code is
     * compiled before the first real request (the first PDF is otherwise ~1 s slower).
     */
    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        Thread.ofVirtual().name("docengine-warmup").start(() -> {
            try {
                long start = System.nanoTime();
                JsonNode doc = JsonMapper.builder().build().readTree("""
                        {"schemaVersion": 3, "document": "resume", "preset": "classic",
                         "sections": [{"id": "s", "nodes": [{"tag": "h1", "text": "Warm-up"},
                           {"tag": "p", "html": "<b>Bold</b> <i>italic</i> text"}]}]}
                        """);
                toPageImages(require(doc, Mode.STRICT));
                log.info("docEngine ready in {} ms", (System.nanoTime() - start) / 1_000_000);
            } catch (RuntimeException e) {
                log.warn("docEngine warm-up failed: {}", e.getClass().getName());
            }
        });
    }

    /** Validates without throwing. */
    public DocReader.Result read(JsonNode json, Mode mode) {
        return DocReader.read(json, mode, presets.stylesById());
    }

    /** A valid document, or 400 DOCUMENT_INVALID with every issue (path, code, message). */
    public Doc require(JsonNode json, Mode mode) {
        DocReader.Result result = read(json, mode);
        if (!result.valid()) {
            throw invalid(result.errors());
        }
        return result.doc();
    }

    public static ApiException invalid(List<Issue> errors) {
        return new ApiException(HttpStatus.BAD_REQUEST, "DOCUMENT_INVALID",
                errors.size() == 1 ? errors.get(0).message() : "The document breaks " + errors.size() + " rules.",
                Map.of("issues", errors));
    }

    public String toXhtml(Doc doc) {
        return DocWriter.toXhtml(doc, presetStyles(doc));
    }

    /** @throws ApiException 422 DOCUMENT_TOO_LONG when the PDF has more pages than {@code page.maxPages} */
    public RenderedPdf toPdf(Doc doc) {
        RenderedPdf rendered = pdf.convert(toXhtml(doc));
        int max = doc.page().maxPages();
        if (rendered.pages() > max) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "DOCUMENT_TOO_LONG",
                    "The document is " + rendered.pages() + " pages but maxPages is " + max
                            + ". Shorten some sections or reduce font sizes and spacing.",
                    Map.of("pages", rendered.pages(), "maxPages", max));
        }
        return rendered;
    }

    public List<byte[]> toPageImages(Doc doc) {
        return pdf.pageImages(toPdf(doc).bytes());
    }

    public JsonNode toJson(Doc doc) {
        return DocJson.write(doc);
    }

    public List<DocPresets.Preset> presets() {
        return presets.all();
    }

    /** The full rules (Markdown) for people and AI assistants. */
    public String rules() {
        return rules;
    }

    private Map<String, Map<String, String>> presetStyles(Doc doc) {
        return presets.find(doc.preset()).map(DocPresets.Preset::styles).orElse(Map.of());
    }

    private static String readRules() {
        try (InputStream in = new ClassPathResource("docengine/spec/doc-rules.md").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Missing docengine/spec/doc-rules.md", e);
        }
    }
}
