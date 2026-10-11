package com.careerpilot.backend.resume;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.document.DocumentTemplate;
import com.careerpilot.backend.document.HtmlDocumentRenderer;
import com.careerpilot.backend.document.PageSize;
import com.careerpilot.backend.document.PdfDocumentConverter;
import com.careerpilot.backend.document.PdfDocumentConverter.RenderedPdf;

/**
 * Resume data → XHTML (preview) → PDF. Deterministic: the same input always gives the same document.
 * Input must already be bean-validated (see ResumeData); this class normalizes it before rendering.
 */
@Service
public class ResumeDocumentService {

    private final ResumeTemplates templates;
    private final HtmlDocumentRenderer html;
    private final PdfDocumentConverter pdf;

    public ResumeDocumentService(ResumeTemplates templates, HtmlDocumentRenderer html, PdfDocumentConverter pdf) {
        this.templates = templates;
        this.html = html;
        this.pdf = pdf;
    }

    public String renderHtml(String templateId, PageSize pageSize, ResumeData data) {
        DocumentTemplate template = template(templateId);
        ResumeView resume = ResumeView.of(data);
        Map<String, Object> model = Map.of(
                "resume", resume,
                "title", resume.name() + " — Resume");
        return html.render(template, model, pageSize == null ? PageSize.A4 : pageSize);
    }

    public RenderedPdf renderPdf(String templateId, PageSize pageSize, ResumeData data) {
        return pdf.convert(renderHtml(templateId, pageSize, data));
    }

    public DocumentTemplate template(String templateId) {
        return templates.find(templateId == null ? ResumeTemplates.DEFAULT_ID : templateId)
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
