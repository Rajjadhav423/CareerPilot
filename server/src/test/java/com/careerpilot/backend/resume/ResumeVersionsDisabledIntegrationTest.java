package com.careerpilot.backend.resume;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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

/** With version history turned off (the default), a resume is a single row that saves overwrite. */
@SpringBootTest(properties = "careerpilot.resumes.versions-enabled=false")
@AutoConfigureMockMvc
class ResumeVersionsDisabledIntegrationTest {

    private static final JwtRequestPostProcessor RAJ = jwt().jwt(t -> t.subject("user_raj"));
    private static final String REQUEST = "{\"title\": \"Main\", \"data\": " + ResumeControllerIntegrationTest.DATA + "}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        jdbc.execute("truncate table users cascade");
    }

    @Test
    void savesOverwriteOneRowAndNoHistoryIsKept() throws Exception {
        String id = JsonPath.read(mockMvc.perform(post("/api/v1/resumes").with(RAJ)
                        .contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(put("/api/v1/resumes/" + id).with(RAJ).contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                    .andExpect(status().isOk());
        }

        assertThat(jdbc.queryForObject("select count(*) from resumes", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from resume_versions", Integer.class)).isZero();

        mockMvc.perform(get("/api/v1/resumes/" + id + "/versions").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(post("/api/v1/resumes/" + id + "/versions").with(RAJ)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"data\": " + ResumeControllerIntegrationTest.DATA + "}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("VERSIONS_DISABLED"));
        mockMvc.perform(get("/api/v1/resumes").with(RAJ)).andExpect(jsonPath("$[0].pendingProposals").value(0));
    }
}
