package com.careerpilot.backend.application;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** An application email that Gmail accepted. The body isn't stored. */
@Entity
@Table(name = "sent_emails")
public class SentEmail {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private UUID userId;

    private UUID jobId;

    private UUID templateId;

    @Column(nullable = false, length = 320)
    private String recipient;

    @Column(nullable = false, length = 255)
    private String subject;

    @Column(nullable = false, length = 128)
    private String gmailMessageId;

    @Column(length = 128)
    private String gmailThreadId;

    @Column(nullable = false)
    private Instant sentAt;

    protected SentEmail() {
        // for JPA
    }

    SentEmail(UUID userId, UUID jobId, UUID templateId, String recipient, String subject, String gmailMessageId,
            String gmailThreadId, Instant sentAt) {
        this.userId = userId;
        this.jobId = jobId;
        this.templateId = templateId;
        this.recipient = recipient;
        this.subject = subject;
        this.gmailMessageId = gmailMessageId;
        this.gmailThreadId = gmailThreadId;
        this.sentAt = sentAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getJobId() {
        return jobId;
    }

    public UUID getTemplateId() {
        return templateId;
    }

    public String getRecipient() {
        return recipient;
    }

    public String getSubject() {
        return subject;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
