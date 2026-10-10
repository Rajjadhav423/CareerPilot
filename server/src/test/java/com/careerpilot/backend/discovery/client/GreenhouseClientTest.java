package com.careerpilot.backend.discovery.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.restclient.test.autoconfigure.RestClientTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

import com.careerpilot.backend.discovery.JobBoard;
import com.careerpilot.backend.discovery.JobPosting;
import com.careerpilot.backend.discovery.WorkplaceType;

@RestClientTest(GreenhouseClient.class)
class GreenhouseClientTest {

    @Autowired
    private GreenhouseClient client;

    @Autowired
    private MockRestServiceServer server;

    @Test
    void mapsGreenhouseJobs() {
        server.expect(requestTo("https://boards-api.greenhouse.io/v1/boards/groww/jobs"))
                .andRespond(withSuccess("""
                        {"jobs": [
                          {"id": 4970739101, "title": "Backend Engineer",
                           "absolute_url": "https://job-boards.greenhouse.io/groww/jobs/4970739101",
                           "location": {"name": "Bengaluru, India"},
                           "first_published": "2026-09-14T03:49:28-04:00",
                           "updated_at": "2026-09-15T00:00:00-04:00",
                           "data_compliance": []},
                          {"id": 2, "title": "SRE", "absolute_url": "https://x/2",
                           "location": {"name": "Remote - India"}, "updated_at": "2026-09-01T00:00:00Z"}
                        ], "meta": {"total": 2}}
                        """, MediaType.APPLICATION_JSON));

        List<JobPosting> jobs = client.fetch(JobBoard.parse("greenhouse:groww:Groww"));

        assertThat(jobs).hasSize(2);
        JobPosting first = jobs.getFirst();
        assertThat(first.id()).isEqualTo("greenhouse-groww-4970739101");
        assertThat(first.title()).isEqualTo("Backend Engineer");
        assertThat(first.company()).isEqualTo("Groww");
        assertThat(first.location()).isEqualTo("Bengaluru, India");
        assertThat(first.workplaceType()).isEqualTo(WorkplaceType.UNSPECIFIED);
        assertThat(first.url()).isEqualTo("https://job-boards.greenhouse.io/groww/jobs/4970739101");
        assertThat(first.postedAt()).isEqualTo(Instant.parse("2026-09-14T07:49:28Z"));
        assertThat(first.source()).isEqualTo("Greenhouse");

        // No first_published: falls back to updated_at. "Remote" in the location marks it remote.
        assertThat(jobs.get(1).postedAt()).isEqualTo(Instant.parse("2026-09-01T00:00:00Z"));
        assertThat(jobs.get(1).workplaceType()).isEqualTo(WorkplaceType.REMOTE);
        server.verify();
    }
}
