package com.careerpilot.backend.discovery;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.careerpilot.backend.discovery.DiscoverResponse.SourceStatus;

@WebMvcTest(DiscoveryController.class)
class DiscoveryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DiscoveryService discoveryService;

    @Test
    void returnsMatchingJobsAndSourceStatus() throws Exception {
        JobPosting job = new JobPosting("lever-cred-1", "Backend Engineer", "CRED", "Bengaluru", "Engineering",
                WorkplaceType.HYBRID, "https://jobs.lever.co/cred/1", Instant.parse("2026-10-01T00:00:00Z"), "Lever",
                TechRole.BACKEND);
        given(discoveryService.search("backend", "bengaluru", TechRole.BACKEND, 50, true)).willReturn(new DiscoverResponse(
                List.of(job), 1, Map.of(TechRole.BACKEND, 1L), Instant.parse("2026-10-11T10:00:00Z"),
                List.of(new SourceStatus("CRED (Lever)", "CRED", "Lever", true, 1, null))));

        mockMvc.perform(get("/api/v1/discover/jobs")
                        .param("q", "backend").param("location", "bengaluru").param("role", "BACKEND")
                        .param("limit", "50").param("refresh", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.fetchedAt").value("2026-10-11T10:00:00Z"))
                .andExpect(jsonPath("$.jobs[0].title").value("Backend Engineer"))
                .andExpect(jsonPath("$.jobs[0].workplaceType").value("HYBRID"))
                .andExpect(jsonPath("$.jobs[0].techRole").value("BACKEND"))
                .andExpect(jsonPath("$.roleCounts.BACKEND").value(1))
                .andExpect(jsonPath("$.jobs[0].postedAt").value("2026-10-01T00:00:00Z"))
                .andExpect(jsonPath("$.sources[0].ok").value(true));
    }

    @Test
    void usesDefaultsWhenNoParams() throws Exception {
        given(discoveryService.search("", "", null, 100, false)).willReturn(
                new DiscoverResponse(List.of(), 0, Map.of(), Instant.parse("2026-10-11T10:00:00Z"), List.of()));

        mockMvc.perform(get("/api/v1/discover/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void unknownRoleIsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/discover/jobs").param("role", "PLUMBER"))
                .andExpect(status().isBadRequest());
    }
}
