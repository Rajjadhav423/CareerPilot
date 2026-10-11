package com.careerpilot.backend.auth.webhook;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.json.JsonMapper;

import com.careerpilot.backend.auth.ClerkProperties;
import com.careerpilot.backend.user.CurrentUserService;
import com.careerpilot.backend.user.CurrentUserService.ClerkProfile;

/**
 * Receives Clerk webhooks so our users table follows Clerk:
 * user.created / user.updated → create or update the row; session.created → record the sign-in;
 * user.deleted → delete the user and their data.
 * Disabled (503) until CLERK_WEBHOOK_SECRET is set. Clerk needs a public URL to reach this endpoint
 * (locally: VS Code port forwarding of 8080 with public visibility).
 */
@RestController
@RequestMapping("/api/v1/webhooks/clerk")
public class ClerkWebhookController {

    private static final Logger log = LoggerFactory.getLogger(ClerkWebhookController.class);

    private final SvixSignatureVerifier verifier;
    private final CurrentUserService currentUsers;
    private final JsonMapper jsonMapper;

    public ClerkWebhookController(ClerkProperties clerk, CurrentUserService currentUsers, JsonMapper jsonMapper) {
        String secret = clerk.webhookSecret();
        this.verifier = secret == null || secret.isBlank() ? null : new SvixSignatureVerifier(secret, Clock.systemUTC());
        this.currentUsers = currentUsers;
        this.jsonMapper = jsonMapper;
    }

    @PostMapping
    public ResponseEntity<Void> receive(
            @RequestBody String body,
            @RequestHeader(value = "svix-id", required = false) String id,
            @RequestHeader(value = "svix-timestamp", required = false) String timestamp,
            @RequestHeader(value = "svix-signature", required = false) String signature) {
        if (verifier == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        if (!verifier.isValid(id, timestamp, signature, body)) {
            log.warn("Rejected Clerk webhook with an invalid signature (svix-id={})", id);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        ClerkEvent event = jsonMapper.readValue(body, ClerkEvent.class);
        if (event.data() == null || event.data().id() == null) {
            return ResponseEntity.badRequest().build();
        }
        switch (event.type()) {
            case "user.created", "user.updated" -> currentUsers.upsertFromClerk(event.data().id(), event.data().profile());
            case "session.created" -> {
                if (event.data().userId() != null) {
                    currentUsers.recordSignIn(event.data().userId(), event.data().createdAtInstant());
                }
            }
            case "user.deleted" -> currentUsers.deleteFromClerk(event.data().id());
            default -> log.debug("Ignoring Clerk webhook event {}", event.type());
        }
        return ResponseEntity.noContent().build();
    }

    record ClerkEvent(String type, ClerkUser data) {
    }

    /** The event's "data": a user for user.* events, a session (with user_id) for session.* events. */
    record ClerkUser(
            String id,
            @JsonProperty("user_id") String userId,
            @JsonProperty("created_at") Long createdAt,
            @JsonProperty("first_name") String firstName,
            @JsonProperty("last_name") String lastName,
            @JsonProperty("image_url") String imageUrl,
            @JsonProperty("primary_email_address_id") String primaryEmailAddressId,
            @JsonProperty("email_addresses") List<EmailAddress> emailAddresses) {

        ClerkProfile profile() {
            String name = Stream.of(firstName, lastName)
                    .filter(part -> part != null && !part.isBlank())
                    .collect(Collectors.joining(" "));
            return new ClerkProfile(primaryEmail(), name.isEmpty() ? null : name, imageUrl);
        }

        /** Clerk timestamps are milliseconds since the epoch. */
        Instant createdAtInstant() {
            return createdAt == null ? null : Instant.ofEpochMilli(createdAt);
        }

        private String primaryEmail() {
            if (emailAddresses == null) {
                return null;
            }
            return emailAddresses.stream()
                    .filter(address -> Objects.equals(address.id(), primaryEmailAddressId))
                    .map(EmailAddress::emailAddress)
                    .findFirst()
                    .orElse(null);
        }
    }

    record EmailAddress(String id, @JsonProperty("email_address") String emailAddress) {
    }
}
