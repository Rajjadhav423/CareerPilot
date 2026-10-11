package com.careerpilot.backend.user;

import java.time.Instant;
import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    private final CurrentUserService currentUsers;

    public MeController(CurrentUserService currentUsers) {
        this.currentUsers = currentUsers;
    }

    /** The signed-in user as CareerPilot knows them (created on first call). */
    @GetMapping
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return MeResponse.from(currentUsers.resolve(jwt));
    }

    public record MeResponse(UUID id, String email, String displayName, String avatarUrl, Instant lastSignedInAt) {

        public static MeResponse from(User user) {
            return new MeResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getAvatarUrl(),
                    user.getLastSignedInAt());
        }
    }
}
