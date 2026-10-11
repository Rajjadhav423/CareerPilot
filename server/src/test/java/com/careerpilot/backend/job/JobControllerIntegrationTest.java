package com.careerpilot.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

/** Full app against the test database; jwt() stands in for a verified Clerk token. */
@SpringBootTest
@AutoConfigureMockMvc
class JobControllerIntegrationTest {

    private static final JwtRequestPostProcessor RAJ = jwt().jwt(t -> t.subject("user_raj").claim("email", "raj@example.com"));
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
    void createManualJobWithDefaults() throws Exception {
        create(RAJ, """
                {"title": "  Backend Engineer ", "company": "CRED", "location": "Bengaluru",
                 "workMode": "HYBRID", "jobUrl": "https://jobs.lever.co/cred/1", "description": "Java, Spring"}
                """)
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith("/api/v1/jobs/")))
                .andExpect(jsonPath("$.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.status").value("SAVED"))
                .andExpect(jsonPath("$.source").value("MANUAL"))
                .andExpect(jsonPath("$.archived").value(false))
                .andExpect(jsonPath("$.workMode").value("HYBRID"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void listShowsOnlyMyActiveJobsNewestFirstAndFiltersByStatus() throws Exception {
        String first = idOf(create(RAJ, job("Old job")));
        create(RAJ, job("New job"));
        create(FRIEND, job("Friend's job"));
        patchJob(RAJ, first, "{\"status\": \"APPLIED\"}");

        mockMvc.perform(get("/api/v1/jobs").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].title").value("Old job")) // just updated → newest change
                .andExpect(jsonPath("$[1].title").value("New job"));
        mockMvc.perform(get("/api/v1/jobs").param("status", "APPLIED").with(RAJ))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].status").value("APPLIED"));
    }

    @Test
    void otherUsersJobsAreInvisibleAndUnchangeable() throws Exception {
        String rajsJob = idOf(create(RAJ, job("Raj's secret job")));

        mockMvc.perform(get("/api/v1/jobs/" + rajsJob).with(FRIEND)).andExpect(status().isNotFound());
        patchJob(FRIEND, rajsJob, "{\"status\": \"REJECTED\"}").andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/jobs").with(FRIEND)).andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/api/v1/jobs/" + rajsJob).with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SAVED"));
    }

    @Test
    void patchUpdatesOnlyGivenFieldsAndEmptyStringClears() throws Exception {
        String id = idOf(create(RAJ, """
                {"title": "Backend Engineer", "company": "CRED", "location": "Bengaluru", "notes": "referral from Amit"}
                """));

        patchJob(RAJ, id, "{\"status\": \"INTERVIEW\", \"location\": \"\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INTERVIEW"))
                .andExpect(jsonPath("$.location").doesNotExist())
                .andExpect(jsonPath("$.notes").value("referral from Amit"))
                .andExpect(jsonPath("$.title").value("Backend Engineer"));
    }

    @Test
    void archivedJobsLeaveTheBoardButAreListedSeparately() throws Exception {
        String id = idOf(create(RAJ, job("Not interested")));
        patchJob(RAJ, id, "{\"archived\": true}").andExpect(jsonPath("$.archived").value(true));

        mockMvc.perform(get("/api/v1/jobs").with(RAJ)).andExpect(jsonPath("$", hasSize(0)));
        mockMvc.perform(get("/api/v1/jobs").param("archived", "true").with(RAJ))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void savingTheSamePostingTwiceReturnsTheExistingJob() throws Exception {
        String posting = """
                {"title": "Backend Engineer", "company": "CRED", "source": "lever", "externalId": "lever-cred-123",
                 "jobUrl": "https://jobs.lever.co/cred/123"}
                """;
        String firstId = idOf(create(RAJ, posting).andExpect(status().isCreated()));

        create(RAJ, posting)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstId))
                .andExpect(jsonPath("$.source").value("LEVER"))
                .andExpect(jsonPath("$.externalId").value("lever-cred-123"));
        // A friend can save the same posting to their own board
        create(FRIEND, posting).andExpect(status().isCreated());

        assertThat(jdbc.queryForObject("select count(*) from jobs", Integer.class)).isEqualTo(2);
    }

    @Test
    void validationErrorsAreReportedPerField() throws Exception {
        create(RAJ, """
                {"title": "", "company": "CRED", "jobUrl": "not a url"}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors.title").exists())
                .andExpect(jsonPath("$.errors.jobUrl").value("must be a valid http(s) URL"));

        String id = idOf(create(RAJ, job("Valid")));
        patchJob(RAJ, id, "{\"title\": \"   \"}").andExpect(status().isBadRequest());
        patchJob(RAJ, id, "{\"status\": \"HIRED_AT_GOOGLE\"}").andExpect(status().isBadRequest());
    }

    @Test
    void unknownOrMalformedIdIs404Or400() throws Exception {
        mockMvc.perform(get("/api/v1/jobs/00000000-0000-0000-0000-000000000000").with(RAJ))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("JOB_NOT_FOUND"));
        mockMvc.perform(get("/api/v1/jobs/not-a-uuid").with(RAJ)).andExpect(status().isBadRequest());
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/v1/jobs")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/jobs").contentType(MediaType.APPLICATION_JSON).content(job("x")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deletingTheUserDeletesTheirJobs() throws Exception {
        create(RAJ, job("Will be removed"));

        jdbc.update("delete from users where clerk_user_id = 'user_raj'");

        assertThat(jdbc.queryForObject("select count(*) from jobs", Integer.class)).isZero();
    }

    private ResultActions create(JwtRequestPostProcessor user, String body) throws Exception {
        return mockMvc.perform(post("/api/v1/jobs").with(user).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions patchJob(JwtRequestPostProcessor user, String id, String body) throws Exception {
        return mockMvc.perform(patch("/api/v1/jobs/" + id).with(user).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static String idOf(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }

    private static String job(String title) {
        return "{\"title\": \"" + title + "\", \"company\": \"Acme\"}";
    }
}
