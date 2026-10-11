package com.careerpilot.backend.job;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.careerpilot.backend.job.JobDtos.CreateJobRequest;
import com.careerpilot.backend.job.JobDtos.JobResponse;
import com.careerpilot.backend.job.JobDtos.UpdateJobRequest;
import com.careerpilot.backend.job.JobService.SaveResult;
import com.careerpilot.backend.user.CurrentUserService;

/** The signed-in user's job board. Jobs of other users are never visible (404). */
@RestController
@RequestMapping("/api/v1/jobs")
public class JobController {

    private final JobService jobService;
    private final CurrentUserService currentUsers;

    public JobController(JobService jobService, CurrentUserService currentUsers) {
        this.jobService = jobService;
        this.currentUsers = currentUsers;
    }

    /** Active jobs, newest change first. {@code ?archived=true} lists archived ones instead. */
    @GetMapping
    public List<JobResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) JobStatus status,
            @RequestParam(defaultValue = "false") boolean archived) {
        return jobService.list(userId(jwt), status, archived).stream().map(JobResponse::from).toList();
    }

    /** 201 for a new job; 200 with the existing job when this posting (externalId) was saved before. */
    @PostMapping
    public ResponseEntity<JobResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateJobRequest request) {
        SaveResult result = jobService.create(userId(jwt), request);
        JobResponse body = JobResponse.from(result.job());
        return result.created()
                ? ResponseEntity.created(URI.create("/api/v1/jobs/" + body.id())).body(body)
                : ResponseEntity.ok(body);
    }

    @GetMapping("/{id}")
    public JobResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return JobResponse.from(jobService.get(userId(jwt), id));
    }

    /** Edit fields, move to another status, or archive ({@code "archived": true}). */
    @PatchMapping("/{id}")
    public JobResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody UpdateJobRequest request) {
        return JobResponse.from(jobService.update(userId(jwt), id, request));
    }

    private UUID userId(Jwt jwt) {
        return currentUsers.resolve(jwt).getId();
    }
}
