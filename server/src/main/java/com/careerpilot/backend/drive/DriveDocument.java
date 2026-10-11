package com.careerpilot.backend.drive;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import org.hibernate.annotations.DynamicUpdate;

/**
 * A file CareerPilot created in the user's Drive. The row is metadata only: removing it never touches the
 * Drive file. Always loaded through its owner (see DriveDocumentRepository).
 */
@Entity
@Table(name = "drive_documents")
@DynamicUpdate
public class DriveDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, length = 128, updatable = false)
    private String driveFileId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 128)
    private String folderId;

    @Column(nullable = false, length = 100)
    private String mimeType;

    private Long sizeBytes;

    @Column(length = 2048)
    private String webViewLink;

    @Column(updatable = false)
    private UUID requestId;

    private UUID resumeId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected DriveDocument() {
        // for JPA
    }

    DriveDocument(UUID userId, String driveFileId, UUID requestId, UUID resumeId) {
        this.userId = userId;
        this.driveFileId = driveFileId;
        this.requestId = requestId;
        this.resumeId = resumeId;
    }

    void refresh(String name, String folderId, String mimeType, Long sizeBytes, String webViewLink) {
        this.name = name;
        this.folderId = folderId;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.webViewLink = webViewLink;
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

    public String getDriveFileId() {
        return driveFileId;
    }

    public String getName() {
        return name;
    }

    public String getFolderId() {
        return folderId;
    }

    public String getMimeType() {
        return mimeType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public String getWebViewLink() {
        return webViewLink;
    }

    public UUID getRequestId() {
        return requestId;
    }

    public UUID getResumeId() {
        return resumeId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
