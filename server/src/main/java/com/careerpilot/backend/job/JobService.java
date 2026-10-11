package com.careerpilot.backend.job;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.job.JobDtos.CreateJobRequest;
import com.careerpilot.backend.job.JobDtos.UpdateJobRequest;

/** A user's job board. Every method takes the owner's id; other users' jobs behave as if they don't exist. */
@Service
public class JobService {

    static final String MANUAL_SOURCE = "MANUAL";

    private final JobRepository jobs;

    public JobService(JobRepository jobs) {
        this.jobs = jobs;
    }

    /** @param created false when this posting was already saved (the existing job is returned) */
    public record SaveResult(Job job, boolean created) {
    }

    @Transactional(readOnly = true)
    public List<Job> list(UUID userId, JobStatus status, boolean archived) {
        return status == null
                ? jobs.findAllByUserIdAndArchivedOrderByUpdatedAtDesc(userId, archived)
                : jobs.findAllByUserIdAndArchivedAndStatusOrderByUpdatedAtDesc(userId, archived, status);
    }

    @Transactional(readOnly = true)
    public Job get(UUID userId, UUID jobId) {
        return jobs.findByIdAndUserId(jobId, userId).orElseThrow(JobService::notFound);
    }

    @Transactional
    public SaveResult create(UUID userId, CreateJobRequest request) {
        String externalId = blankToNull(request.externalId());
        if (externalId != null) {
            var existing = jobs.findByUserIdAndExternalId(userId, externalId);
            if (existing.isPresent()) {
                return new SaveResult(existing.get(), false);
            }
        }
        String source = externalId == null || request.source() == null || request.source().isBlank()
                ? MANUAL_SOURCE
                : request.source().trim().toUpperCase(Locale.ROOT);

        Job job = new Job(userId, request.title().trim(), request.company().trim(), source, externalId);
        job.setLocation(blankToNull(request.location()));
        job.setWorkMode(request.workMode());
        job.setJobUrl(blankToNull(request.jobUrl()));
        job.setDescription(blankToNull(request.description()));
        job.setNotes(blankToNull(request.notes()));
        if (request.status() != null) {
            job.setStatus(request.status());
        }
        return new SaveResult(jobs.saveAndFlush(job), true);
    }

    @Transactional
    public Job update(UUID userId, UUID jobId, UpdateJobRequest request) {
        Job job = get(userId, jobId);
        if (request.title() != null) {
            job.setTitle(requireText(request.title(), "title"));
        }
        if (request.company() != null) {
            job.setCompany(requireText(request.company(), "company"));
        }
        if (request.location() != null) {
            job.setLocation(blankToNull(request.location()));
        }
        if (request.workMode() != null) {
            job.setWorkMode(request.workMode());
        }
        if (request.jobUrl() != null) {
            job.setJobUrl(blankToNull(request.jobUrl()));
        }
        if (request.description() != null) {
            job.setDescription(blankToNull(request.description()));
        }
        if (request.notes() != null) {
            job.setNotes(blankToNull(request.notes()));
        }
        if (request.status() != null) {
            job.setStatus(request.status());
        }
        if (request.archived() != null) {
            job.setArchived(request.archived());
        }
        return jobs.saveAndFlush(job);
    }

    private static String requireText(String value, String field) {
        if (value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", field + " must not be blank");
        }
        return value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "JOB_NOT_FOUND", "Job not found.");
    }
}
