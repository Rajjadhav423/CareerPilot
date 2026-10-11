package com.careerpilot.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Full app against the test database. jwt() stands in for an already-verified Clerk token
 * (signature checks are covered by ClerkTokenValidationTest).
 */
@SpringBootTest
@AutoConfigureMockMvc
class MeControllerIntegrationTest {

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
    void firstCallCreatesUserFromClerkToken() throws Exception {
        mockMvc.perform(get("/api/v1/me").with(jwt().jwt(token -> token
                        .subject("user_raj")
                        .claim("email", "Raj@Example.com")
                        .claim("name", "Raj Jadhav")
                        .claim("picture", "https://img.clerk.com/raj.png"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.email").value("raj@example.com"))
                .andExpect(jsonPath("$.displayName").value("Raj Jadhav"))
                .andExpect(jsonPath("$.avatarUrl").value("https://img.clerk.com/raj.png"));

        assertThat(users.findByClerkUserId("user_raj")).isPresent();
    }

    @Test
    void laterCallsReuseTheSameUserAndRefreshProfile() throws Exception {
        String firstId = JsonPath.read(mockMvc.perform(get("/api/v1/me")
                        .with(jwt().jwt(token -> token.subject("user_friend").claim("name", "Old Name"))))
                .andReturn().getResponse().getContentAsString(), "$.id");

        mockMvc.perform(get("/api/v1/me")
                        .with(jwt().jwt(token -> token.subject("user_friend").claim("name", "New Name"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstId))
                .andExpect(jsonPath("$.displayName").value("New Name"));

        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void differentClerkUsersGetDifferentAccounts() throws Exception {
        mockMvc.perform(get("/api/v1/me").with(jwt().jwt(token -> token.subject("user_a")))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/me").with(jwt().jwt(token -> token.subject("user_b")))).andExpect(status().isOk());

        assertThat(users.count()).isEqualTo(2);
    }

    @Test
    void withoutTokenIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void healthStaysPublic() throws Exception {
        mockMvc.perform(get("/api/v1/health")).andExpect(status().isOk());
    }

    @Test
    void discoveryRequiresLogin() throws Exception {
        mockMvc.perform(get("/api/v1/discover/jobs")).andExpect(status().isUnauthorized());
    }
}
