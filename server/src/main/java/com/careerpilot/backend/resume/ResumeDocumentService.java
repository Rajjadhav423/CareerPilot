package com.careerpilot.backend.resume;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.docengine.DocEngine;
import com.careerpilot.backend.docengine.DocModel.Doc;
import com.careerpilot.backend.docengine.DocPresets;
import com.careerpilot.backend.docengine.DocPresets.Preset;
import com.careerpilot.backend.docengine.DocReader;
import com.careerpilot.backend.docengine.PageSize;
import com.careerpilot.backend.docengine.PdfDocumentConverter.RenderedPdf;

/**
 * Resume data (the editor's format) → docEngine document → XHTML / PDF / page images. The resume is converted
 * to document JSON with the chosen template's preset ({@link ResumeToDoc}) and then goes through exactly the
 * same validation and rendering as any document sent to {@code /api/v1/docs}.
 */
@Service
public class ResumeDocumentService {

    public static final String DEFAULT_TEMPLATE = "classic";

    private final DocEngine engine;
    private final DocPresets presets;

    public ResumeDocumentService(DocEngine engine, DocPresets presets) {
        this.engine = engine;
        this.presets = presets;
    }

    /** The resume as document JSON (schema version 3). */
    public ObjectNode toDocument(String templateId, PageSize pageSize, ResumeData data) {
        return ResumeToDoc.convert(template(templateId).id(), pageSize, data);
    }

    public String renderHtml(String templateId, PageSize pageSize, ResumeData data) {
        return engine.toXhtml(doc(templateId, pageSize, data));
    }

    public RenderedPdf renderPdf(String templateId, PageSize pageSize, ResumeData data) {
        return engine.toPdf(doc(templateId, pageSize, data));
    }

    /** The PDF's pages as PNG images, for a preview that matches the PDF exactly (page breaks included). */
    public List<byte[]> renderPageImages(String templateId, PageSize pageSize, ResumeData data) {
        return engine.toPageImages(doc(templateId, pageSize, data));
    }

    private Doc doc(String templateId, PageSize pageSize, ResumeData data) {
        return engine.require(toDocument(templateId, pageSize, data), DocReader.Mode.STRICT);
    }

    /**
     * A docEngine document checked with the strict rules and written back in its normalized form (what gets
     * stored). 400 DOCUMENT_INVALID with every issue otherwise.
     */
    public JsonNode normalizeDocument(JsonNode document) {
        return engine.toJson(engine.require(document, DocReader.Mode.STRICT));
    }

    /** Renders a saved/stored document, e.g. for Drive. */
    public RenderedPdf renderDocumentPdf(JsonNode document) {
        return engine.toPdf(engine.require(document, DocReader.Mode.STRICT));
    }

    /** Templates are docEngine presets. */
    public List<Preset> templates() {
        return presets.all();
    }

    public Preset template(String templateId) {
        return presets.find(templateId == null ? DEFAULT_TEMPLATE : templateId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "UNKNOWN_TEMPLATE",
                        "That resume template doesn't exist."));
    }

    /**
     * A safe download name: letters, digits, spaces and a few punctuation marks, ending in ".pdf".
     * Used for the download header and as the default Drive file name.
     */
    public static String fileName(String preferred, ResumeData data) {
        String base = preferred;
        if (base == null || base.isBlank()) {
            String name = data == null || data.basics() == null ? null : data.basics().fullName();
            base = (name == null || name.isBlank() ? "Resume" : name.strip() + " - Resume");
        }
        String cleaned = base.replaceAll("(?i)\\.pdf$", "")
                .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", " ")
                .replaceAll("\\s+", " ")
                .strip();
        if (cleaned.length() > 120) {
            cleaned = cleaned.substring(0, 120).strip();
        }
        return (cleaned.isEmpty() || cleaned.matches("\\.+") ? "Resume" : cleaned) + ".pdf";
    }
}
