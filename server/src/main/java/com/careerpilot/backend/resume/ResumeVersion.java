package com.careerpilot.backend.resume;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import org.hibernate.annotations.ColumnTransformer;

import com.careerpilot.backend.document.PageSize;

/** One snapshot of a resume: a saved state, or a proposal waiting for the owner's decision. */
@Entity
@Table(name = "resume_versions")
public class ResumeVersion {

    public enum Source {
        EDITOR, IMPORT, AI, RESTORE
    }

    public enum Status {
        /** A state the resume had (history). */
        SAVED,
        /** Suggested changes (imported JSON, an AI assistant…) not applied yet. */
        PROPOSED,
        /** A proposal the owner accepted; it then became the resume's content. */
        ACCEPTED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private UUID resumeId;

    @Column(nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, updatable = false)
    private int number;

    @Column(length = 120)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private Source source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(nullable = false, length = 40, updatable = false)
    private String templateId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    private PageSize pageSize;

    @Column(nullable = false, columnDefinition = "jsonb", updatable = false)
    @ColumnTransformer(write = "?::jsonb")
    private String data;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected ResumeVersion() {
        // for JPA
    }

    ResumeVersion(UUID resumeId, UUID userId, int number, String label, Source source, Status status, String templateId,
            PageSize pageSize, String data) {
        this.resumeId = resumeId;
        this.userId = userId;
        this.number = number;
        this.label = label;
        this.source = source;
        this.status = status;
        this.templateId = templateId;
        this.pageSize = pageSize;
        this.data = data;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    void markAccepted() {
        this.status = Status.ACCEPTED;
    }

    public UUID getId() {
        return id;
    }

    public UUID getResumeId() {
        return resumeId;
    }

    public int getNumber() {
        return number;
    }

    public String getLabel() {
        return label;
    }

    public Source getSource() {
        return source;
    }

    public Status getStatus() {
        return status;
    }

    public String getTemplateId() {
        return templateId;
    }

    public PageSize getPageSize() {
        return pageSize;
    }

    public String getData() {
        return data;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
