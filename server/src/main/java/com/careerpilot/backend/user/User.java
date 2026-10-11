package com.careerpilot.backend.user;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
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
 * A CareerPilot user. Accounts (passwords, Google sign-in, email verification) live in Clerk;
 * this row links the Clerk user to our data. Profile fields are copied from the Clerk session token.
 *
 * {@code @DynamicUpdate}: updates write only changed columns, so a sign-in webhook and a profile webhook
 * processed at the same moment can't overwrite each other's fields.
 */
@Entity
@Table(name = "users")
@DynamicUpdate
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 64)
    private String clerkUserId;

    @Column(length = 320)
    private String email;

    @Column(length = 100)
    private String displayName;

    @Column(length = 2048)
    private String avatarUrl;

    private Instant lastSignedInAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected User() {
        // for JPA
    }

    private User(String clerkUserId) {
        this.clerkUserId = clerkUserId;
    }

    public static User fromClerk(String clerkUserId, String email, String displayName, String avatarUrl) {
        User user = new User(clerkUserId);
        user.updateProfile(email, displayName, avatarUrl);
        return user;
    }

    /**
     * Copies profile fields from Clerk. A missing (null) value keeps what we already have.
     * @return true if anything changed
     */
    public boolean updateProfile(String email, String displayName, String avatarUrl) {
        String newEmail = email == null ? this.email : normaliseEmail(email);
        String newName = displayName == null ? this.displayName : truncate(displayName, 100);
        String newAvatar = avatarUrl == null ? this.avatarUrl : avatarUrl;
        boolean changed = !Objects.equals(newEmail, this.email)
                || !Objects.equals(newName, this.displayName)
                || !Objects.equals(newAvatar, this.avatarUrl);
        this.email = newEmail;
        this.displayName = newName;
        this.avatarUrl = newAvatar;
        return changed;
    }

    public void recordSignIn(Instant when) {
        lastSignedInAt = when;
    }

    /** Lower-cased and trimmed, matching the database constraint. */
    public static String normaliseEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String truncate(String value, int max) {
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
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

    public String getClerkUserId() {
        return clerkUserId;
    }

    public String getEmail() {
        return email;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public Instant getLastSignedInAt() {
        return lastSignedInAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
