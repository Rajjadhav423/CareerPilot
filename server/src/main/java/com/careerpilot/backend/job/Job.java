package com.careerpilot.backend.job;

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

import org.hibernate.annotations.DynamicUpdate;

/** A job a user is tracking on their board. Always loaded through its owner (see JobRepository). */
@Entity
@Table(name = "jobs")
@DynamicUpdate
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 200)
    private String company;

    @Column(length = 200)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private WorkMode workMode;

    @Column(length = 2048)
    private String jobUrl;

    @Column(columnDefinition = "text")
    private String description;

    @Column(columnDefinition = "text")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private JobStatus status;

    @Column(nullable = false, updatable = false, length = 32)
    private String source;

    @Column(updatable = false, length = 200)
    private String externalId;

    @Column(nullable = false)
    private boolean archived;

    private Instant appliedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Job() {
        // for JPA
    }

    Job(UUID userId, String title, String company, String source, String externalId) {
        this.userId = userId;
        this.title = title;
        this.company = company;
        this.source = source;
        this.externalId = externalId;
        this.status = JobStatus.SAVED;
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

    void setTitle(String title) {
        this.title = title;
    }

    void setCompany(String company) {
        this.company = company;
    }

    void setLocation(String location) {
        this.location = location;
    }

    void setWorkMode(WorkMode workMode) {
        this.workMode = workMode;
    }

    void setJobUrl(String jobUrl) {
        this.jobUrl = jobUrl;
    }

    void setDescription(String description) {
        this.description = description;
    }

    void setNotes(String notes) {
        this.notes = notes;
    }

    void setStatus(JobStatus status) {
        this.status = status;
    }

    void setArchived(boolean archived) {
        this.archived = archived;
    }

    /** First time an application was sent; later sends keep the original date. */
    void markApplied(Instant when) {
        if (appliedAt == null) {
            appliedAt = when;
        }
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

    public String getCompany() {
        return company;
    }

    public String getLocation() {
        return location;
    }

    public WorkMode getWorkMode() {
        return workMode;
    }

    public String getJobUrl() {
        return jobUrl;
    }

    public String getDescription() {
        return description;
    }

    public String getNotes() {
        return notes;
    }

    public JobStatus getStatus() {
        return status;
    }

    public String getSource() {
        return source;
    }

    public String getExternalId() {
        return externalId;
    }

    public boolean isArchived() {
        return archived;
    }

    public Instant getAppliedAt() {
        return appliedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
