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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.DynamicUpdate;

import com.careerpilot.backend.document.PageSize;

/** A resume a user wrote in CareerPilot. Always loaded through its owner (see ResumeRepository). */
@Entity
@Table(name = "resumes")
@DynamicUpdate
public class Resume {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 40)
    private String templateId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PageSize pageSize;

    /** Validated, normalized ResumeData as JSON. */
    @Column(nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String data;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Resume() {
        // for JPA
    }

    Resume(UUID userId, String title, String templateId, PageSize pageSize, String data) {
        this.userId = userId;
        update(title, templateId, pageSize, data);
    }

    void update(String title, String templateId, PageSize pageSize, String data) {
        this.title = title;
        this.templateId = templateId;
        this.pageSize = pageSize;
        this.data = data;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
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

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
