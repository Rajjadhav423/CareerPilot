package com.careerpilot.backend.resume;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.document.PageSize;
import com.careerpilot.backend.drive.DriveDocumentService;
import com.careerpilot.backend.drive.DriveDtos.DriveDocumentResponse;
import com.careerpilot.backend.resume.ResumeDtos.DiffResponse;
import com.careerpilot.backend.resume.ResumeDtos.ProposalRequest;
import com.careerpilot.backend.resume.ResumeDtos.RenderRequest;
import com.careerpilot.backend.resume.ResumeDtos.ResumeRequest;
import com.careerpilot.backend.resume.ResumeDtos.ResumeResponse;
import com.careerpilot.backend.resume.ResumeDtos.ResumeSummary;
import com.careerpilot.backend.resume.ResumeDtos.TemplateResponse;
import com.careerpilot.backend.resume.ResumeDtos.VersionResponse;
import com.careerpilot.backend.resume.ResumeDtos.VersionSummary;
import com.careerpilot.backend.user.CurrentUserService;
import com.careerpilot.backend.user.User;

import tools.jackson.databind.JsonNode;

/**
 * Saved resumes, plus rendering (HTML preview, PDF download, save to Google Drive). Rendering endpoints take
 * the resume data in the request, so unsaved edits can be previewed. Other users' resumes are never visible (404).
 */
@RestController
@RequestMapping("/api/v1/resumes")
public class ResumeController {

    /** The preview is our own escaped markup, but it's shown in the browser: forbid scripts and remote loads. */
    private static final String PREVIEW_CSP =
            "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors *";

    public record SaveToDriveRequest(
            @NotNull(message = "is required") UUID requestId,
            @Size(max = 40) String templateId,
            PageSize pageSize,
            @NotNull(message = "is required") @Valid ResumeData data,
            @Size(max = 150) String fileName,
            @Pattern(regexp = "[A-Za-z0-9_-]{1,128}", message = "is not a folder id") String folderId,
            UUID resumeId) {
    }

    private final ResumeService resumes;
    private final ResumeDocumentService documents;
    private final ResumeTemplates templates;
    private final DriveDocumentService drive;
    private final CurrentUserService currentUsers;
    private final ResumeJson json;
    private final Validator validator;
    private final byte[] schema;

    public ResumeController(ResumeService resumes, ResumeDocumentService documents, ResumeTemplates templates,
            DriveDocumentService drive, CurrentUserService currentUsers, ResumeJson json, Validator validator) {
        this.json = json;
        this.validator = validator;
        this.schema = readSchema();
        this.resumes = resumes;
        this.documents = documents;
        this.templates = templates;
        this.drive = drive;
        this.currentUsers = currentUsers;
    }

    @GetMapping("/templates")
    public List<TemplateResponse> templates() {
        return templates.all().stream().map(t -> new TemplateResponse(t.id(), t.name(), t.description())).toList();
    }

    /** JSON Schema of the resume format, for people and AI assistants writing resume JSON. */
    @GetMapping(value = "/schema", produces = "application/schema+json")
    public ResponseEntity<byte[]> schema() {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/schema+json")).body(schema);
    }

    /**
     * Checks resume JSON in either format (the current one or the original fixed-section one) and returns it
     * cleaned up in the current format, with ids filled in. Used before importing JSON written elsewhere.
     */
    @PostMapping("/normalize")
    public ResponseEntity<?> normalize(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode body) {
        userId(jwt);
        ResumeData data = json.read(body);
        Set<ConstraintViolation<ResumeData>> violations = validator.validate(data);
        if (!violations.isEmpty()) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Some fields are invalid.");
            problem.setTitle("Validation failed");
            problem.setProperty("code", "VALIDATION_FAILED");
            Map<String, String> errors = new LinkedHashMap<>();
            violations.forEach(v -> errors.putIfAbsent("data." + v.getPropertyPath().toString()
                    .replaceAll(".<list element>", "").replaceAll("<list element>", ""), v.getMessage()));
            problem.setProperty("errors", errors);
            return ResponseEntity.badRequest().body(problem);
        }
        return ResponseEntity.ok(data.normalized());
    }

    @GetMapping
    public List<ResumeSummary> list(@AuthenticationPrincipal Jwt jwt) {
        return resumes.list(userId(jwt));
    }

    @PostMapping
    public ResponseEntity<ResumeResponse> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ResumeRequest request) {
        ResumeResponse body = resumes.create(userId(jwt), request);
        return ResponseEntity.created(URI.create("/api/v1/resumes/" + body.id())).body(body);
    }

    @GetMapping("/{id}")
    public ResumeResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return resumes.get(userId(jwt), id);
    }

    @PutMapping("/{id}")
    public ResumeResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody ResumeRequest request) {
        return resumes.update(userId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        resumes.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    // ---- versions: history and proposals ----

    @GetMapping("/{id}/versions")
    public List<VersionSummary> versions(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return resumes.versions(userId(jwt), id);
    }

    /** Suggest changes (imported JSON, an AI assistant). The resume changes only when the owner accepts. */
    @PostMapping("/{id}/versions")
    public ResponseEntity<VersionResponse> propose(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody ProposalRequest request) {
        VersionResponse body = resumes.propose(userId(jwt), id, request);
        return ResponseEntity.created(URI.create("/api/v1/resumes/" + id + "/versions/" + body.id())).body(body);
    }

    @GetMapping("/{id}/versions/{versionId}")
    public VersionResponse version(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID versionId) {
        return resumes.version(userId(jwt), id, versionId);
    }

    /** What would change if this version replaced the current resume. */
    @GetMapping("/{id}/versions/{versionId}/diff")
    public DiffResponse diff(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID versionId) {
        return resumes.diff(userId(jwt), id, versionId);
    }

    /** Accept a proposal, or restore an older version. */
    @PostMapping("/{id}/versions/{versionId}/accept")
    public ResumeResponse accept(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID versionId) {
        return resumes.accept(userId(jwt), id, versionId);
    }

    @DeleteMapping("/{id}/versions/{versionId}")
    public ResponseEntity<Void> discard(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID versionId) {
        resumes.discard(userId(jwt), id, versionId);
        return ResponseEntity.noContent().build();
    }

    /** The document as HTML, for the editor's live preview (shown in a sandboxed frame). */
    @PostMapping(value = "/render/preview", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> preview(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RenderRequest request) {
        userId(jwt);
        String html = documents.renderHtml(request.templateId(), request.pageSize(), request.data());
        return ResponseEntity.ok()
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .header("Content-Security-Policy", PREVIEW_CSP)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(html);
    }

    /** The PDF's pages as PNG images (base64), so the preview matches the PDF exactly, page by page. */
    @PostMapping("/render/pages")
    public ResponseEntity<PagesResponse> pages(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RenderRequest request) {
        userId(jwt);
        List<String> pages = documents.renderPageImages(request.templateId(), request.pageSize(), request.data()).stream()
                .map(png -> Base64.getEncoder().encodeToString(png))
                .toList();
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(new PagesResponse(pages.size(), pages));
    }

    /** @param pages base64-encoded PNG images, one per page */
    public record PagesResponse(int pageCount, List<String> pages) {
    }

    /** The PDF as a download. */
    @PostMapping(value = "/render/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> pdf(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RenderRequest request) {
        userId(jwt);
        var pdf = documents.renderPdf(request.templateId(), request.pageSize(), request.data());
        String fileName = ResumeDocumentService.fileName(request.fileName(), request.data());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Document-Pages", Integer.toString(pdf.pages()))
                .body(pdf.bytes());
    }

    /** Generates the PDF and saves it to the user's Google Drive. Retrying with the same requestId is safe. */
    @PostMapping("/render/drive")
    public ResponseEntity<DriveDocumentResponse> saveToDrive(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody SaveToDriveRequest request) {
        User user = currentUsers.resolve(jwt);
        if (request.resumeId() != null && !resumes.isOwnedBy(user.getId(), request.resumeId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "RESUME_NOT_FOUND", "Resume not found.");
        }
        var pdf = documents.renderPdf(request.templateId(), request.pageSize(), request.data());
        String fileName = ResumeDocumentService.fileName(request.fileName(), request.data());
        DriveDocumentResponse saved = drive.uploadPdf(user, request.requestId(), fileName, request.folderId(),
                request.resumeId(), pdf.bytes());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    private static byte[] readSchema() {
        try (InputStream in = new ClassPathResource("documents/schema/resume.schema.json").getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Missing resume JSON schema", e);
        }
    }

    private UUID userId(Jwt jwt) {
        return currentUsers.resolve(jwt).getId();
    }
}
