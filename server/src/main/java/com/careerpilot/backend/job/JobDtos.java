package com.careerpilot.backend.job;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request and response bodies for /api/v1/jobs. */
public final class JobDtos {

    /** http(s) URL, or empty (empty clears the field on update). */
    static final String URL_PATTERN = "^$|^https?://\\S+$";
    static final String URL_MESSAGE = "must be a valid http(s) URL";

    private JobDtos() {
    }

    /**
     * Add a job. {@code source}/{@code externalId} are set when saving a posting from Find jobs;
     * saving the same externalId again returns the existing job.
     */
    public record CreateJobRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 200) String company,
            @Size(max = 200) String location,
            WorkMode workMode,
            @Size(max = 2048) @Pattern(regexp = URL_PATTERN, message = URL_MESSAGE) String jobUrl,
            @Size(max = 20_000) String description,
            @Size(max = 10_000) String notes,
            JobStatus status,
            @Size(max = 32) String source,
            @Size(max = 200) String externalId) {
    }

    /**
     * Partial update: fields left out (null) stay as they are. For optional text fields an empty
     * string clears the value. Title and company can't be cleared.
     */
    public record UpdateJobRequest(
            @Size(min = 1, max = 200) String title,
            @Size(min = 1, max = 200) String company,
            @Size(max = 200) String location,
            WorkMode workMode,
            @Size(max = 2048) @Pattern(regexp = URL_PATTERN, message = URL_MESSAGE) String jobUrl,
            @Size(max = 20_000) String description,
            @Size(max = 10_000) String notes,
            JobStatus status,
            Boolean archived) {
    }

    public record JobResponse(
            UUID id,
            String title,
            String company,
            String location,
            WorkMode workMode,
            String jobUrl,
            String description,
            String notes,
            JobStatus status,
            boolean archived,
            String source,
            String externalId,
            Instant appliedAt,
            Instant createdAt,
            Instant updatedAt) {

        static JobResponse from(Job job) {
            return new JobResponse(job.getId(), job.getTitle(), job.getCompany(), job.getLocation(),
                    job.getWorkMode(), job.getJobUrl(), job.getDescription(), job.getNotes(), job.getStatus(),
                    job.isArchived(), job.getSource(), job.getExternalId(), job.getAppliedAt(), job.getCreatedAt(),
                    job.getUpdatedAt());
        }
    }
}
