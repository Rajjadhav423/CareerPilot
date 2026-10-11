package com.careerpilot.backend.auth.webhook;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.careerpilot.backend.user.User;
import com.careerpilot.backend.user.UserRepository;

/** Signed webhook deliveries (like Clerk/Svix sends them) against the test database. */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "careerpilot.clerk.webhook-secret=" + ClerkWebhookIntegrationTest.SECRET)
class ClerkWebhookIntegrationTest {

    static final String SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

    private final SvixSignatureVerifier signer = new SvixSignatureVerifier(SECRET, Clock.systemUTC());

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        jdbc.execute("truncate table users cascade");
    }

    @Test
    void userCreatedStoresTheUser() throws Exception {
        send(userEvent("user.created", "user_new", "Raj", "Jadhav", "Raj@Example.com")).andExpect(status().isNoContent());

        User user = users.findByClerkUserId("user_new").orElseThrow();
        assertThat(user.getEmail()).isEqualTo("raj@example.com");
        assertThat(user.getDisplayName()).isEqualTo("Raj Jadhav");
        assertThat(user.getAvatarUrl()).isEqualTo("https://img.clerk.com/user_new.png");
    }

    @Test
    void userUpdatedChangesProfile() throws Exception {
        send(userEvent("user.created", "user_upd", "Old", null, "old@example.com"));
        send(userEvent("user.updated", "user_upd", "New", "Name", "new@example.com")).andExpect(status().isNoContent());

        User user = users.findByClerkUserId("user_upd").orElseThrow();
        assertThat(user.getEmail()).isEqualTo("new@example.com");
        assertThat(user.getDisplayName()).isEqualTo("New Name");
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void sessionCreatedRecordsSignInTime() throws Exception {
        send(userEvent("user.created", "user_signin", "Sign", "In", "signin@example.com"));
        send("""
                {"type": "session.created", "data": {"id": "sess_1", "object": "session",
                  "user_id": "user_signin", "status": "active", "created_at": 1791021600000}}
                """).andExpect(status().isNoContent());

        User user = users.findByClerkUserId("user_signin").orElseThrow();
        assertThat(user.getLastSignedInAt()).isEqualTo(Instant.ofEpochMilli(1791021600000L));
        assertThat(user.getEmail()).isEqualTo("signin@example.com");
    }

    @Test
    void sessionBeforeUserCreatedStillStoresUser() throws Exception {
        send("""
                {"type": "session.created", "data": {"id": "sess_2", "user_id": "user_early", "created_at": 1791021600000}}
                """).andExpect(status().isNoContent());
        send(userEvent("user.created", "user_early", "Early", null, "early@example.com"));

        User user = users.findByClerkUserId("user_early").orElseThrow();
        assertThat(user.getLastSignedInAt()).isNotNull();
        assertThat(user.getEmail()).isEqualTo("early@example.com");
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void userDeletedRemovesTheUser() throws Exception {
        send(userEvent("user.created", "user_gone", "Gone", null, "gone@example.com"));
        send("""
                {"type": "user.deleted", "data": {"id": "user_gone", "deleted": true, "object": "user"}}
                """).andExpect(status().isNoContent());

        assertThat(users.findByClerkUserId("user_gone")).isEmpty();
    }

    @Test
    void sameEventTwiceIsHarmless() throws Exception {
        String event = userEvent("user.created", "user_twice", "Twice", null, "twice@example.com");
        send(event).andExpect(status().isNoContent());
        send(event).andExpect(status().isNoContent());

        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void otherEventTypesAreIgnored() throws Exception {
        send("""
                {"type": "organization.created", "data": {"id": "org_1"}}
                """).andExpect(status().isNoContent());

        assertThat(users.count()).isZero();
    }

    @Test
    void invalidSignatureIsRejectedAndNothingStored() throws Exception {
        String body = userEvent("user.created", "user_evil", "Evil", null, "evil@example.com");

        mockMvc.perform(post("/api/v1/webhooks/clerk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("svix-id", "msg_evil")
                        .header("svix-timestamp", String.valueOf(Instant.now().getEpochSecond()))
                        .header("svix-signature", "v1,ZmFrZQ==")
                        .content(body))
                .andExpect(status().isUnauthorized());

        assertThat(users.count()).isZero();
    }

    private ResultActions send(String body) throws Exception {
        String id = "msg_" + System.nanoTime();
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        return mockMvc.perform(post("/api/v1/webhooks/clerk")
                .contentType(MediaType.APPLICATION_JSON)
                .header("svix-id", id)
                .header("svix-timestamp", timestamp)
                .header("svix-signature", signer.sign(id, timestamp, body))
                .content(body));
    }

    /** Shape of Clerk's user.created / user.updated payload (trimmed). */
    private static String userEvent(String type, String userId, String first, String last, String email) {
        return """
                {"type": "%s", "object": "event", "data": {
                  "id": "%s", "object": "user",
                  "first_name": %s, "last_name": %s,
                  "image_url": "https://img.clerk.com/%s.png",
                  "primary_email_address_id": "idn_primary",
                  "email_addresses": [
                    {"id": "idn_other", "email_address": "other@example.com"},
                    {"id": "idn_primary", "email_address": "%s"}
                  ]}}
                """.formatted(type, userId, json(first), json(last), userId, email);
    }

    private static String json(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }
}
