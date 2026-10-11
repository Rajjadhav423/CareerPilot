package com.careerpilot.backend.template;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request and response bodies for /api/v1/email-templates. */
public final class EmailTemplateDtos {

    /** A subject is one line: line breaks would allow email header injection. */
    static final String SINGLE_LINE = "[^\\r\\n]*";
    static final String SINGLE_LINE_MESSAGE = "must be a single line";

    private EmailTemplateDtos() {
    }

    /** Create or replace a template. Placeholders must be allowlisted merge fields. */
    public record TemplateRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Size(max = 255) @Pattern(regexp = SINGLE_LINE, message = SINGLE_LINE_MESSAGE) String subject,
            @NotBlank @Size(max = 20_000) String body,
            boolean isDefault) {
    }

    /** Preview text with sample data (nothing is saved). */
    public record PreviewRequest(
            @Size(max = 255) String subject,
            @Size(max = 20_000) String body) {
    }

    public record PreviewResponse(String subject, String body, List<String> unknownPlaceholders) {
    }

    public record MergeFieldResponse(String key, String placeholder, String label, String description, String sample) {

        static MergeFieldResponse from(MergeField field) {
            return new MergeFieldResponse(field.key(), field.placeholder(), field.label(), field.description(),
                    field.sample());
        }
    }

    public record TemplateResponse(
            UUID id,
            String name,
            String subject,
            String body,
            boolean isDefault,
            Instant createdAt,
            Instant updatedAt) {

        static TemplateResponse from(EmailTemplate template) {
            return new TemplateResponse(template.getId(), template.getName(), template.getSubject(),
                    template.getBody(), template.isDefaultTemplate(), template.getCreatedAt(), template.getUpdatedAt());
        }
    }
}
