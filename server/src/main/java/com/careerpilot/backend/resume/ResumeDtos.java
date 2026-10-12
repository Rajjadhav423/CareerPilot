package com.careerpilot.backend.resume;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import tools.jackson.databind.JsonNode;

import com.careerpilot.backend.docengine.PageSize;

public final class ResumeDtos {

    private ResumeDtos() {
    }

    /**
     * Create or replace a saved resume. {@code data} is the form content; {@code document} (optional) is a
     * docEngine document that, when present, is what gets rendered (validated with the document rules).
     */
    public record ResumeRequest(
            @NotBlank(message = "is required") @Size(max = 120) String title,
            @Size(max = 40) String templateId,
            PageSize pageSize,
            @NotNull(message = "is required") @Valid ResumeData data,
            JsonNode document) {
    }

    /** Render resume data that may not be saved yet (preview, download, save to Drive). */
    public record RenderRequest(
            @Size(max = 40) String templateId,
            PageSize pageSize,
            @NotNull(message = "is required") @Valid ResumeData data,
            @Size(max = 150) String fileName) {
    }

    /**
     * Suggested changes to a saved resume (imported JSON, an AI assistant). Stored as a proposal; the resume
     * changes only when its owner accepts it.
     */
    public record ProposalRequest(
            @Size(max = 120) String label,
            ResumeVersion.Source source,
            @Size(max = 40) String templateId,
            PageSize pageSize,
            @Valid ResumeData data,
            JsonNode document) {
    }

    public record ResumeSummary(UUID id, String title, String templateId, PageSize pageSize, String fullName,
            int pendingProposals, Instant createdAt, Instant updatedAt) {
    }

    public record ResumeResponse(UUID id, String title, String templateId, PageSize pageSize, ResumeData data,
            JsonNode document, Instant createdAt, Instant updatedAt) {
    }

    public record TemplateResponse(String id, String name, String description) {
    }

    /** {@code changes}: number of differences from the current resume (proposals only). */
    public record VersionSummary(UUID id, int number, String label, ResumeVersion.Source source,
            ResumeVersion.Status status, Integer changes, Instant createdAt) {
    }

    public record VersionResponse(UUID id, int number, String label, ResumeVersion.Source source,
            ResumeVersion.Status status, String templateId, PageSize pageSize, ResumeData data, JsonNode document,
            Instant createdAt) {
    }

    public record DiffResponse(UUID versionId, int number, List<ResumeDiff.Change> changes) {
    }
}
