package com.careerpilot.backend.drive;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import org.hibernate.annotations.DynamicUpdate;

/** A user's Drive preferences (on/off, chosen folder). Holds no credentials: Clerk keeps the Google token. */
@Entity
@Table(name = "drive_settings")
@DynamicUpdate
public class DriveSettings {

    @Id
    private UUID userId;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(length = 320)
    private String googleEmail;

    @Column(length = 128)
    private String folderId;

    @Column(length = 255)
    private String folderName;

    @Column(nullable = false)
    private Instant updatedAt;

    protected DriveSettings() {
        // for JPA
    }

    DriveSettings(UUID userId) {
        this.userId = userId;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    void setGoogleEmail(String googleEmail) {
        this.googleEmail = googleEmail;
    }

    void selectFolder(String folderId, String folderName) {
        this.folderId = folderId;
        this.folderName = folderName;
    }

    public UUID getUserId() {
        return userId;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getGoogleEmail() {
        return googleEmail;
    }

    public String getFolderId() {
        return folderId;
    }

    public String getFolderName() {
        return folderName;
    }
}
