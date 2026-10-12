package com.careerpilot.backend.docengine;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.JsonNode;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.docengine.DocModel.Doc;
import com.careerpilot.backend.docengine.DocReader.Mode;
import com.careerpilot.backend.user.CurrentUserService;

/**
 * docEngine API: the rules, presets, validation and rendering of document JSON (doc-rules.md). Every request
 * body is {@code { "document": {…}, "mode": "strict" | "lenient", "fileName"?: "…" }}.
 */
@RestController
@RequestMapping("/api/v1/docs")
public class DocController {

    /** The HTML is our own escaped markup, but it's shown in a browser: forbid scripts and remote loads. */
    static final String HTML_CSP =
            "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors *";

    private final DocEngine engine;
    private final CurrentUserService currentUsers;

    public DocController(DocEngine engine, CurrentUserService currentUsers) {
        this.engine = engine;
        this.currentUsers = currentUsers;
    }

    @GetMapping(value = "/rules", produces = "text/markdown;charset=UTF-8")
    public ResponseEntity<String> rules(@AuthenticationPrincipal Jwt jwt) {
        currentUsers.resolve(jwt);
        return ResponseEntity.ok().contentType(new MediaType("text", "markdown", StandardCharsets.UTF_8)).body(engine.rules());
    }

    @GetMapping("/presets")
    public List<DocPresets.Preset> presets(@AuthenticationPrincipal Jwt jwt) {
        currentUsers.resolve(jwt);
        return engine.presets();
    }

    /**
     * Checks a document. Valid documents are also rendered once to report their page count; lenient mode
     * returns the repaired document.
     */
    @PostMapping("/validate")
    public Map<String, Object> validate(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        currentUsers.resolve(jwt);
        Mode mode = mode(body);
        DocReader.Result result = engine.read(document(body), mode);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("valid", result.valid());
        response.put("errors", result.errors());
        response.put("warnings", result.warnings());
        Integer pages = null;
        if (result.valid()) {
            try {
                pages = engine.toPdf(result.doc()).pages();
            } catch (ApiException e) {
                // Too long or too large: report it like a rule error
                response.put("valid", false);
                response.put("errors", List.of(new DocReader.Issue("/page/maxPages", e.code(), e.getMessage())));
            }
            if (mode == Mode.LENIENT) {
                response.put("document", engine.toJson(result.doc()));
            }
        }
        response.put("pages", pages);
        return response;
    }

    @PostMapping(value = "/render/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> pdf(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        currentUsers.resolve(jwt);
        Doc doc = engine.require(document(body), mode(body));
        var pdf = engine.toPdf(doc);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(fileName(body.path("fileName").asString(null), doc), StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Document-Pages", Integer.toString(pdf.pages()))
                .body(pdf.bytes());
    }

    /** @return the PDF's pages as base64 PNG images (an exact preview) */
    @PostMapping("/render/pages")
    public ResponseEntity<Map<String, Object>> pages(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        currentUsers.resolve(jwt);
        Doc doc = engine.require(document(body), mode(body));
        List<String> pages = engine.toPageImages(doc).stream().map(png -> Base64.getEncoder().encodeToString(png)).toList();
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(Map.of("pageCount", pages.size(), "pages", pages));
    }

    @PostMapping(value = "/render/html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> html(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        currentUsers.resolve(jwt);
        Doc doc = engine.require(document(body), mode(body));
        return ResponseEntity.ok()
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .header("Content-Security-Policy", HTML_CSP)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(engine.toXhtml(doc));
    }

    private static JsonNode document(JsonNode body) {
        if (body == null || !body.isObject() || !body.path("document").isObject()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DOCUMENT_MISSING",
                    "Send { \"document\": { … } } (see GET /api/v1/docs/rules).");
        }
        return body.get("document");
    }

    private static Mode mode(JsonNode body) {
        String mode = body == null ? "" : body.path("mode").asString("strict").toLowerCase(Locale.ROOT);
        return switch (mode) {
            case "strict", "" -> Mode.STRICT;
            case "lenient" -> Mode.LENIENT;
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "MODE_INVALID", "mode must be \"strict\" or \"lenient\".");
        };
    }

    /** A safe download name: from the request, else the document title, else "Document". */
    static String fileName(String preferred, Doc doc) {
        String base = preferred != null && !preferred.isBlank() ? preferred
                : doc.meta().title() != null ? doc.meta().title()
                : doc.document() == DocModel.Kind.coverLetter ? "Cover letter" : "Resume";
        String cleaned = base.replaceAll("(?i)\\.pdf$", "")
                .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", " ")
                .replaceAll("\\s+", " ")
                .strip();
        if (cleaned.length() > 120) {
            cleaned = cleaned.substring(0, 120).strip();
        }
        return (cleaned.isEmpty() || cleaned.matches("\\.+") ? "Document" : cleaned) + ".pdf";
    }
}
