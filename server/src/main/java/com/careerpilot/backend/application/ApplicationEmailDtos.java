package com.careerpilot.backend.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.careerpilot.backend.job.JobStatus;

/** Request and response bodies for /api/v1/jobs/{jobId}/emails. */
public final class ApplicationEmailDtos {

    /** One plain address, e.g. hiring@company.com. No display names, lists or line breaks. */
    static final String EMAIL_ADDRESS = "^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(\\.[A-Za-z0-9-]{1,63})*\\.[A-Za-z]{2,63}$";

    private ApplicationEmailDtos() {
    }

    /**
     * @param templateId template to use; omitted = the user's default template (or a blank email if none)
     * @param timeZone   the browser's IANA time zone, used to format {{application_date}}
     */
    public record ComposeRequest(UUID templateId, @Size(max = 64) String timeZone) {
    }

    public record MissingField(String key, String placeholder, String label) {
    }

    /**
     * The template filled with this job's details. Placeholders without a value stay in the text and are listed
     * in {@code missingFields}; nothing is invented. Editing the result never changes the saved template.
     */
    public record ComposeResponse(
            UUID templateId,
            String templateName,
            String subject,
            String body,
            List<MissingField> missingFields,
            List<String> unknownPlaceholders) {
    }

    /**
     * @param confirmed must be true: the user reviewed the email and explicitly chose to send it
     */
    public record SendRequest(
            @NotBlank @Size(max = 254) @Pattern(regexp = EMAIL_ADDRESS, message = "must be a single valid email address")
            String to,
            @NotBlank @Size(max = 255) @Pattern(regexp = "[^\\r\\n]*", message = "must be a single line") String subject,
            @NotBlank @Size(max = 20_000) String body,
            UUID templateId,
            boolean confirmed) {
    }

    public record SendResponse(UUID id, Instant sentAt, JobStatus jobStatus, Instant appliedAt) {
    }

    public record SentEmailResponse(UUID id, String recipient, String subject, UUID templateId, Instant sentAt) {

        static SentEmailResponse from(SentEmail email) {
            return new SentEmailResponse(email.getId(), email.getRecipient(), email.getSubject(), email.getTemplateId(),
                    email.getSentAt());
        }
    }
}
