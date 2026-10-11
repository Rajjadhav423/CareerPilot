package com.careerpilot.backend.gmail;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.careerpilot.backend.gmail.GmailService.GmailStatus;
import com.careerpilot.backend.user.CurrentUserService;

@RestController
@RequestMapping("/api/v1/gmail")
public class GmailController {

    private final GmailService gmailService;
    private final CurrentUserService currentUsers;

    public GmailController(GmailService gmailService, CurrentUserService currentUsers) {
        this.gmailService = gmailService;
        this.currentUsers = currentUsers;
    }

    /** Whether the signed-in user can send from Gmail, and from which address. Never includes tokens. */
    @GetMapping("/status")
    public GmailStatus status(@AuthenticationPrincipal Jwt jwt) {
        return gmailService.status(currentUsers.resolve(jwt));
    }
}
