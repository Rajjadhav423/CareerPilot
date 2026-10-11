package com.careerpilot.backend.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.Set;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccessToken;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccount;
import com.careerpilot.backend.gmail.GmailApiClient;
import com.careerpilot.backend.gmail.GmailApiClient.SentMessage;

/**
 * Compose and send against the test database. Clerk's Backend API and Gmail are mocked: no real email is sent.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApplicationEmailIntegrationTest {

    private static final JwtRequestPostProcessor RAJ = jwt().jwt(t -> t.subject("user_raj")
            .claim("email", "raj@example.com").claim("name", "Raj Jadhav"));
    private static final JwtRequestPostProcessor FRIEND = jwt().jwt(t -> t.subject("user_friend"));
    private static final GoogleAccessToken SEND_TOKEN =
            new GoogleAccessToken("ya29.google-token", Set.of(ClerkGoogleAccounts.GMAIL_SEND_SCOPE));

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoBean
    private ClerkGoogleAccounts googleAccounts;

    @MockitoBean
    private GmailApiClient gmail;

    private String jobId;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.execute("truncate table users cascade");
        given(googleAccounts.isConfigured()).willReturn(true);
        jobId = idOf(mockMvc.perform(post("/api/v1/jobs").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title": "Backend Engineer", "company": "CRED", "location": "Bengaluru",
                         "jobUrl": "https://jobs.lever.co/cred/1"}
                        """)));
    }

    @Test
    void composeFillsJobAndCandidateFieldsAndFlagsMissingOnes() throws Exception {
        String templateId = createTemplate(RAJ, true,
                "Application: {{job_title}} at {{company_name}}",
                "Hi, I'm {{candidate_name}} ({{candidate_email}}). Resume: {{resume_url}}. Applying on {{application_date}}"
                        + " via {{application_url}} for {{job_location}}.");

        compose(RAJ, "{\"timeZone\": \"Asia/Kolkata\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templateId").value(templateId))
                .andExpect(jsonPath("$.subject").value("Application: Backend Engineer at CRED"))
                .andExpect(jsonPath("$.body").value(containsString("Hi, I'm Raj Jadhav (raj@example.com).")))
                .andExpect(jsonPath("$.body").value(containsString("Resume: {{resume_url}}.")))
                .andExpect(jsonPath("$.body").value(containsString("via https://jobs.lever.co/cred/1 for Bengaluru.")))
                .andExpect(jsonPath("$.missingFields", hasSize(1)))
                .andExpect(jsonPath("$.missingFields[0].key").value("resume_url"))
                .andExpect(jsonPath("$.unknownPlaceholders", hasSize(0)));
    }

    @Test
    void composeWithoutAnyTemplateGivesABlankEmail() throws Exception {
        compose(RAJ, "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templateId").doesNotExist())
                .andExpect(jsonPath("$.subject").value(""));
    }

    @Test
    void editingTheComposedEmailNeverChangesTheTemplate() throws Exception {
        String templateId = createTemplate(RAJ, false, "Hello {{company_name}}", "Body {{job_title}}");

        given(googleAccounts.findAccessToken("user_raj")).willReturn(Optional.of(SEND_TOKEN));
        given(gmail.send(any(), anyString())).willReturn(new SentMessage("msg_1", "thr_1"));
        send(RAJ, "hr@cred.club", "Edited subject", "Completely rewritten body", templateId, true)
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/email-templates/" + templateId).with(RAJ))
                .andExpect(jsonPath("$.subject").value("Hello {{company_name}}"))
                .andExpect(jsonPath("$.body").value("Body {{job_title}}"));
    }

    @Test
    void successfulSendRecordsTheEmailAndMarksTheJobApplied() throws Exception {
        given(googleAccounts.findAccessToken("user_raj")).willReturn(Optional.of(SEND_TOKEN));
        given(gmail.send(any(), anyString())).willReturn(new SentMessage("msg_123", "thr_9"));

        send(RAJ, "hr@cred.club", "Application: Backend Engineer", "Dear team,\nPlease find my details.", null, true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("APPLIED"))
                .andExpect(jsonPath("$.appliedAt").isNotEmpty())
                .andExpect(content().string(not(containsString("ya29"))));

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(gmail).send(any(), message.capture());
        assertThat(message.getValue()).contains("To: hr@cred.club").contains("Subject: Application: Backend Engineer");

        mockMvc.perform(get("/api/v1/jobs/" + jobId + "/emails").with(RAJ))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].recipient").value("hr@cred.club"));
        mockMvc.perform(get("/api/v1/jobs/" + jobId).with(RAJ))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.appliedAt").isNotEmpty());
    }

    @Test
    void laterStagesAreNeverMovedBackToApplied() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .patch("/api/v1/jobs/" + jobId).with(RAJ).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\": \"INTERVIEW\"}"));
        given(googleAccounts.findAccessToken("user_raj")).willReturn(Optional.of(SEND_TOKEN));
        given(gmail.send(any(), anyString())).willReturn(new SentMessage("msg_2", "thr_2"));

        send(RAJ, "hr@cred.club", "Thank you", "Thanks for the interview.", null, true)
                .andExpect(jsonPath("$.jobStatus").value("INTERVIEW"));
    }

    @Test
    void sendingRequiresExplicitConfirmation() throws Exception {
        send(RAJ, "hr@cred.club", "Hi", "Body", null, false)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CONFIRMATION_REQUIRED"));
        verify(gmail, never()).send(any(), anyString());
    }

    @Test
    void unresolvedPlaceholdersBlockSending() throws Exception {
        send(RAJ, "hr@cred.club", "Application {{job_title}}", "Resume: {{resume_url}}", null, true)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("UNRESOLVED_PLACEHOLDERS"))
                .andExpect(jsonPath("$.detail").value(containsString("{{resume_url}}")));
        verify(gmail, never()).send(any(), anyString());
        assertThat(jdbc.queryForObject("select count(*) from sent_emails", Integer.class)).isZero();
    }

    @Test
    void invalidRecipientsAndHeaderInjectionAreRejected() throws Exception {
        for (String to : new String[] {"not-an-email", "a@b.co, c@d.co", "Raj <raj@x.com>", "a@b.co\r\nBcc: x@y.co"}) {
            send(RAJ, to, "Hi", "Body", null, true).andExpect(status().isBadRequest());
        }
        send(RAJ, "hr@cred.club", "Hi\r\nBcc: everyone@example.com", "Body", null, true)
                .andExpect(status().isBadRequest());
        verify(gmail, never()).send(any(), anyString());
    }

    @Test
    void gmailFailureLeavesJobAndHistoryUnchanged() throws Exception {
        given(googleAccounts.findAccessToken("user_raj")).willReturn(Optional.of(SEND_TOKEN));
        given(gmail.send(any(), anyString())).willThrow(new ApiException(HttpStatus.BAD_GATEWAY, "GMAIL_UNAVAILABLE",
                "Gmail is unavailable right now."));

        send(RAJ, "hr@cred.club", "Hi", "Body", null, true)
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("GMAIL_UNAVAILABLE"));

        mockMvc.perform(get("/api/v1/jobs/" + jobId).with(RAJ))
                .andExpect(jsonPath("$.status").value("SAVED"))
                .andExpect(jsonPath("$.appliedAt").doesNotExist());
        assertThat(jdbc.queryForObject("select count(*) from sent_emails", Integer.class)).isZero();
    }

    @Test
    void notConnectedOrMissingPermissionIsReported() throws Exception {
        given(googleAccounts.findAccessToken("user_raj")).willReturn(Optional.empty());
        send(RAJ, "hr@cred.club", "Hi", "Body", null, true)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GMAIL_NOT_CONNECTED"));

        given(googleAccounts.findAccessToken("user_raj"))
                .willReturn(Optional.of(new GoogleAccessToken("ya29.no-send", Set.of("openid", "email"))));
        send(RAJ, "hr@cred.club", "Hi", "Body", null, true)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GMAIL_PERMISSION_MISSING"));
        verify(gmail, never()).send(any(), anyString());
    }

    @Test
    void usersCanOnlyUseTheirOwnJobsTemplatesAndGmail() throws Exception {
        String rajsTemplate = createTemplate(RAJ, false, "S", "B");

        // Friend can't compose or send for Raj's job, or use Raj's template on their own job
        compose(FRIEND, "{}").andExpect(status().isNotFound());
        send(FRIEND, "hr@cred.club", "Hi", "Body", null, true).andExpect(status().isNotFound());
        String friendsJob = idOf(mockMvc.perform(post("/api/v1/jobs").with(FRIEND)
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\": \"Dev\", \"company\": \"Acme\"}")));
        mockMvc.perform(post("/api/v1/jobs/" + friendsJob + "/emails/compose").with(FRIEND)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"templateId\": \"" + rajsTemplate + "\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/jobs/" + jobId + "/emails").with(FRIEND)).andExpect(status().isNotFound());
        verify(googleAccounts, never()).findAccessToken("user_raj");
    }

    @Test
    void gmailStatusShowsConnectionWithoutTokens() throws Exception {
        given(googleAccounts.findGoogleAccount("user_raj")).willReturn(Optional.of(
                new GoogleAccount("raj@gmail.com", Set.of(ClerkGoogleAccounts.GMAIL_SEND_SCOPE))));

        mockMvc.perform(get("/api/v1/gmail/status").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.canSend").value(true))
                .andExpect(jsonPath("$.googleEmail").value("raj@gmail.com"));

        given(googleAccounts.isConfigured()).willReturn(false);
        mockMvc.perform(get("/api/v1/gmail/status").with(RAJ))
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.canSend").value(false));
    }

    private ResultActions compose(JwtRequestPostProcessor user, String body) throws Exception {
        return mockMvc.perform(post("/api/v1/jobs/" + jobId + "/emails/compose").with(user)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions send(JwtRequestPostProcessor user, String to, String subject, String body,
            String templateId, boolean confirmed) throws Exception {
        String json = """
                {"to": %s, "subject": %s, "body": %s, "templateId": %s, "confirmed": %s}
                """.formatted(quote(to), quote(subject), quote(body),
                templateId == null ? "null" : quote(templateId), confirmed);
        return mockMvc.perform(post("/api/v1/jobs/" + jobId + "/emails").with(user)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private String createTemplate(JwtRequestPostProcessor user, boolean isDefault, String subject, String body)
            throws Exception {
        return idOf(mockMvc.perform(post("/api/v1/email-templates").with(user).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"T\", \"subject\": %s, \"body\": %s, \"isDefault\": %s}"
                        .formatted(quote(subject), quote(body), isDefault))));
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "\\r").replace("\n", "\\n") + "\"";
    }

    private static String idOf(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }
}
