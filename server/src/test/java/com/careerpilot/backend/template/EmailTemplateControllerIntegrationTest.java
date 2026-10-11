package com.careerpilot.backend.template;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class EmailTemplateControllerIntegrationTest {

    private static final JwtRequestPostProcessor RAJ = jwt().jwt(t -> t.subject("user_raj"));
    private static final JwtRequestPostProcessor FRIEND = jwt().jwt(t -> t.subject("user_friend"));

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        jdbc.execute("truncate table users cascade");
    }

    @Test
    void createListUpdateAndDelete() throws Exception {
        String id = idOf(create(RAJ, template("Intro", "Application for {{job_title}}", false))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Intro"))
                .andExpect(jsonPath("$.isDefault").value(false)));

        mockMvc.perform(put("/api/v1/email-templates/" + id).with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content(template("Intro v2", "Re: {{job_title}} at {{company_name}}", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Intro v2"))
                .andExpect(jsonPath("$.subject").value("Re: {{job_title}} at {{company_name}}"));

        mockMvc.perform(get("/api/v1/email-templates").with(RAJ)).andExpect(jsonPath("$", hasSize(1)));
        mockMvc.perform(delete("/api/v1/email-templates/" + id).with(RAJ)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/email-templates").with(RAJ)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void onlyOneDefaultTemplateAndItIsListedFirst() throws Exception {
        String first = idOf(create(RAJ, template("B first default", "S", true)));
        String second = idOf(create(RAJ, template("A second default", "S", true)));

        mockMvc.perform(get("/api/v1/email-templates").with(RAJ))
                .andExpect(jsonPath("$[0].id").value(second))
                .andExpect(jsonPath("$[0].isDefault").value(true))
                .andExpect(jsonPath("$[1].id").value(first))
                .andExpect(jsonPath("$[1].isDefault").value(false));

        // Make the first one default again via update
        mockMvc.perform(put("/api/v1/email-templates/" + first).with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content(template("B first default", "S", true)))
                .andExpect(jsonPath("$.isDefault").value(true));
        mockMvc.perform(get("/api/v1/email-templates/" + second).with(RAJ))
                .andExpect(jsonPath("$.isDefault").value(false));
    }

    @Test
    void duplicateCreatesANonDefaultCopy() throws Exception {
        String id = idOf(create(RAJ, template("Follow-up", "Following up on {{job_title}}", true)));

        mockMvc.perform(post("/api/v1/email-templates/" + id + "/duplicate").with(RAJ))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Copy of Follow-up"))
                .andExpect(jsonPath("$.subject").value("Following up on {{job_title}}"))
                .andExpect(jsonPath("$.isDefault").value(false));
    }

    @Test
    void unknownOrMalformedPlaceholdersAreRejected() throws Exception {
        create(RAJ, template("Bad", "Hello {{salary}}", false))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNKNOWN_PLACEHOLDERS"))
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("{{salary}}")));
        create(RAJ, """
                {"name": "Bad", "subject": "Hi", "body": "Dear {{candidate_name", "isDefault": false}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void subjectMustBeSingleLine() throws Exception {
        create(RAJ, """
                {"name": "Inject", "subject": "Hi\\r\\nBcc: everyone@example.com", "body": "x", "isDefault": false}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.subject").value("must be a single line"));
    }

    @Test
    void otherUsersTemplatesAreInvisibleAndUnchangeable() throws Exception {
        String rajs = idOf(create(RAJ, template("Raj's", "S", false)));

        mockMvc.perform(get("/api/v1/email-templates/" + rajs).with(FRIEND)).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/email-templates/" + rajs).with(FRIEND).contentType(MediaType.APPLICATION_JSON)
                .content(template("Hijacked", "S", false))).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/email-templates/" + rajs + "/duplicate").with(FRIEND))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/email-templates/" + rajs).with(FRIEND)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/email-templates").with(FRIEND)).andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/api/v1/email-templates/" + rajs).with(RAJ)).andExpect(jsonPath("$.name").value("Raj's"));
    }

    @Test
    void previewUsesSampleDataAndFlagsUnknownPlaceholders() throws Exception {
        mockMvc.perform(post("/api/v1/email-templates/preview").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"subject": "{{job_title}} at {{company_name}}", "body": "Hi, I'm {{candidate_name}}. {{oops}}"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subject").value("Backend Engineer at Northwind Labs"))
                .andExpect(jsonPath("$.body").value("Hi, I'm Priya Sharma. {{oops}}"))
                .andExpect(jsonPath("$.unknownPlaceholders[0]").value("{{oops}}"));
    }

    @Test
    void mergeFieldsListIsTheAllowlist() throws Exception {
        mockMvc.perform(get("/api/v1/email-templates/merge-fields").with(RAJ))
                .andExpect(jsonPath("$", hasSize(9)))
                .andExpect(jsonPath("$[0].placeholder").value("{{candidate_name}}"));
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/v1/email-templates")).andExpect(status().isUnauthorized());
    }

    private ResultActions create(JwtRequestPostProcessor user, String body) throws Exception {
        return mockMvc.perform(post("/api/v1/email-templates").with(user)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static String template(String name, String subject, boolean isDefault) {
        return """
                {"name": "%s", "subject": "%s", "body": "Dear team,\\nI'm {{candidate_name}}.", "isDefault": %s}
                """.formatted(name, subject, isDefault);
    }

    private static String idOf(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }
}
