package com.careerpilot.backend.template;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

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

import com.careerpilot.backend.template.EmailTemplateDtos.MergeFieldResponse;
import com.careerpilot.backend.template.EmailTemplateDtos.PreviewRequest;
import com.careerpilot.backend.template.EmailTemplateDtos.PreviewResponse;
import com.careerpilot.backend.template.EmailTemplateDtos.TemplateRequest;
import com.careerpilot.backend.template.EmailTemplateDtos.TemplateResponse;
import com.careerpilot.backend.user.CurrentUserService;

/** The signed-in user's email templates. Templates of other users are never visible (404). */
@RestController
@RequestMapping("/api/v1/email-templates")
public class EmailTemplateController {

    private final EmailTemplateService templateService;
    private final CurrentUserService currentUsers;

    public EmailTemplateController(EmailTemplateService templateService, CurrentUserService currentUsers) {
        this.templateService = templateService;
        this.currentUsers = currentUsers;
    }

    /** The supported merge fields (the allowlist), for the editor's insert menu. */
    @GetMapping("/merge-fields")
    public List<MergeFieldResponse> mergeFields() {
        return Arrays.stream(MergeField.values()).map(MergeFieldResponse::from).toList();
    }

    /** Default template first, then by name. */
    @GetMapping
    public List<TemplateResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return templateService.list(userId(jwt)).stream().map(TemplateResponse::from).toList();
    }

    @PostMapping
    public ResponseEntity<TemplateResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody TemplateRequest request) {
        TemplateResponse body = TemplateResponse.from(templateService.create(userId(jwt), request));
        return ResponseEntity.created(URI.create("/api/v1/email-templates/" + body.id())).body(body);
    }

    /** Fills merge fields with sample data. Nothing is saved. */
    @PostMapping("/preview")
    public PreviewResponse preview(@Valid @RequestBody PreviewRequest request) {
        return templateService.preview(request.subject(), request.body());
    }

    @GetMapping("/{id}")
    public TemplateResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return TemplateResponse.from(templateService.get(userId(jwt), id));
    }

    @PutMapping("/{id}")
    public TemplateResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody TemplateRequest request) {
        return TemplateResponse.from(templateService.update(userId(jwt), id, request));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<TemplateResponse> duplicate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        TemplateResponse body = TemplateResponse.from(templateService.duplicate(userId(jwt), id));
        return ResponseEntity.created(URI.create("/api/v1/email-templates/" + body.id())).body(body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        templateService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private UUID userId(Jwt jwt) {
        return currentUsers.resolve(jwt).getId();
    }
}
