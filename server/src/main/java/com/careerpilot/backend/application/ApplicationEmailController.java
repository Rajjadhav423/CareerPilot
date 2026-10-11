package com.careerpilot.backend.application;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.careerpilot.backend.application.ApplicationEmailDtos.ComposeRequest;
import com.careerpilot.backend.application.ApplicationEmailDtos.ComposeResponse;
import com.careerpilot.backend.application.ApplicationEmailDtos.SendRequest;
import com.careerpilot.backend.application.ApplicationEmailDtos.SendResponse;
import com.careerpilot.backend.application.ApplicationEmailDtos.SentEmailResponse;
import com.careerpilot.backend.user.CurrentUserService;

/** Application emails for one of the signed-in user's jobs. Other users' jobs are never visible (404). */
@RestController
@RequestMapping("/api/v1/jobs/{jobId}/emails")
public class ApplicationEmailController {

    private final ApplicationEmailService applicationEmails;
    private final CurrentUserService currentUsers;

    public ApplicationEmailController(ApplicationEmailService applicationEmails, CurrentUserService currentUsers) {
        this.applicationEmails = applicationEmails;
        this.currentUsers = currentUsers;
    }

    /** Fills a template with this job's details for editing. Sends nothing and saves nothing. */
    @PostMapping("/compose")
    public ComposeResponse compose(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID jobId,
            @Valid @RequestBody ComposeRequest request) {
        return applicationEmails.compose(currentUsers.resolve(jwt), jobId, request.templateId(), request.timeZone());
    }

    /** Sends the reviewed email from the user's Gmail. Requires {@code "confirmed": true}. */
    @PostMapping
    public SendResponse send(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID jobId,
            @Valid @RequestBody SendRequest request) {
        return applicationEmails.send(currentUsers.resolve(jwt), jobId, request);
    }

    /** Emails Gmail accepted for this job, newest first. */
    @GetMapping
    public List<SentEmailResponse> history(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID jobId) {
        return applicationEmails.history(currentUsers.resolve(jwt), jobId).stream().map(SentEmailResponse::from).toList();
    }
}
