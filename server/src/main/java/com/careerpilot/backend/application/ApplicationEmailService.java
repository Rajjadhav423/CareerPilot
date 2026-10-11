package com.careerpilot.backend.application;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.careerpilot.backend.application.ApplicationEmailDtos.ComposeResponse;
import com.careerpilot.backend.application.ApplicationEmailDtos.MissingField;
import com.careerpilot.backend.application.ApplicationEmailDtos.SendRequest;
import com.careerpilot.backend.application.ApplicationEmailDtos.SendResponse;
import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.gmail.GmailApiClient.SentMessage;
import com.careerpilot.backend.gmail.GmailService;
import com.careerpilot.backend.job.Job;
import com.careerpilot.backend.job.JobService;
import com.careerpilot.backend.template.EmailTemplate;
import com.careerpilot.backend.template.EmailTemplateService;
import com.careerpilot.backend.template.MergeField;
import com.careerpilot.backend.template.MergeFields;
import com.careerpilot.backend.user.User;

/**
 * Application emails for one of the user's jobs: compose from a template, then send through the user's Gmail
 * after explicit confirmation. The job is updated only after Gmail accepts the message.
 */
@Service
public class ApplicationEmailService {

    private static final DateTimeFormatter APPLICATION_DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH);

    private final JobService jobService;
    private final EmailTemplateService templateService;
    private final GmailService gmailService;
    private final SentEmailRepository sentEmails;
    private final TransactionTemplate transaction;

    public ApplicationEmailService(JobService jobService, EmailTemplateService templateService,
            GmailService gmailService, SentEmailRepository sentEmails, TransactionTemplate transaction) {
        this.jobService = jobService;
        this.templateService = templateService;
        this.gmailService = gmailService;
        this.sentEmails = sentEmails;
        this.transaction = transaction;
    }

    public ComposeResponse compose(User user, UUID jobId, UUID templateId, String timeZone) {
        Job job = jobService.get(user.getId(), jobId);
        EmailTemplate template = templateId != null
                ? templateService.get(user.getId(), templateId)
                : templateService.findDefault(user.getId()).orElse(null);
        if (template == null) {
            return new ComposeResponse(null, null, "", "", List.of(), List.of());
        }

        Map<MergeField, String> values = mergeValues(user, job, zone(timeZone));
        MergeFields.Resolution subject = MergeFields.resolve(template.getSubject(), values);
        MergeFields.Resolution body = MergeFields.resolve(template.getBody(), values);

        Set<MergeField> missing = EnumSet.noneOf(MergeField.class);
        missing.addAll(subject.missing());
        missing.addAll(body.missing());
        Set<String> unknown = new LinkedHashSet<>(subject.unknown());
        unknown.addAll(body.unknown());

        return new ComposeResponse(template.getId(), template.getName(), subject.text(), body.text(),
                missing.stream().map(f -> new MissingField(f.key(), f.placeholder(), f.label())).toList(),
                new ArrayList<>(unknown));
    }

    public SendResponse send(User user, UUID jobId, SendRequest request) {
        if (!request.confirmed()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CONFIRMATION_REQUIRED",
                    "Review the email and confirm before sending.");
        }
        Job job = jobService.get(user.getId(), jobId);
        UUID templateId = request.templateId() == null
                ? null
                : templateService.get(user.getId(), request.templateId()).getId();

        Set<String> unresolved = new LinkedHashSet<>(MergeFields.remainingPlaceholders(request.subject()));
        unresolved.addAll(MergeFields.remainingPlaceholders(request.body()));
        if (!unresolved.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "UNRESOLVED_PLACEHOLDERS",
                    "Replace these placeholders before sending: " + String.join(", ", unresolved));
        }

        // Talks to Gmail outside any database transaction; nothing is recorded unless Gmail accepts the message.
        SentMessage sent = gmailService.send(user, request.to().trim(), request.subject().trim(), request.body());
        Instant sentAt = Instant.now();

        return transaction.execute(status -> {
            SentEmail record = sentEmails.save(new SentEmail(user.getId(), job.getId(), templateId,
                    request.to().trim(), request.subject().trim(), sent.messageId(), sent.threadId(), sentAt));
            Job updated = jobService.recordApplicationSent(user.getId(), job.getId(), sentAt);
            return new SendResponse(record.getId(), sentAt, updated.getStatus(), updated.getAppliedAt());
        });
    }

    public List<SentEmail> history(User user, UUID jobId) {
        Job job = jobService.get(user.getId(), jobId);
        return sentEmails.findAllByUserIdAndJobIdOrderBySentAtDesc(user.getId(), job.getId());
    }

    /** Only real data; a missing value stays missing (null) so the placeholder is flagged, never invented. */
    private static Map<MergeField, String> mergeValues(User user, Job job, ZoneId zone) {
        Map<MergeField, String> values = new EnumMap<>(MergeField.class);
        values.put(MergeField.CANDIDATE_NAME, user.getDisplayName());
        values.put(MergeField.CANDIDATE_EMAIL, user.getEmail());
        values.put(MergeField.RESUME_URL, null); // no resume library yet
        values.put(MergeField.JOB_TITLE, job.getTitle());
        values.put(MergeField.COMPANY_NAME, job.getCompany());
        values.put(MergeField.JOB_LOCATION, job.getLocation());
        values.put(MergeField.JOB_URL, job.getJobUrl());
        values.put(MergeField.APPLICATION_URL, job.getJobUrl()); // one link per job: "where you found it or apply"
        LocalDate applicationDate = job.getAppliedAt() != null
                ? job.getAppliedAt().atZone(zone).toLocalDate()
                : LocalDate.now(zone);
        values.put(MergeField.APPLICATION_DATE, APPLICATION_DATE.format(applicationDate));
        return values;
    }

    private static ZoneId zone(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(timeZone);
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }
}
