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

@RestClientTest(AshbyClient.class)
class AshbyClientTest {

    @Autowired
    private AshbyClient client;

    @Autowired
    private MockRestServiceServer server;

    @Test
    void mapsListedAshbyJobsAndSkipsUnlisted() {
        server.expect(requestTo("https://api.ashbyhq.com/posting-api/job-board/sarvam"))
                .andRespond(withSuccess("""
                        {"apiVersion": "1", "jobs": [
                          {"id": "c0406fe0", "title": "ML Engineer", "department": "Research",
                           "location": "Bengaluru", "publishedAt": "2026-04-17T11:46:39.214+00:00",
                           "isListed": true, "isRemote": true, "workplaceType": null,
                           "jobUrl": "https://jobs.ashbyhq.com/sarvam/c0406fe0"},
                          {"id": "hidden", "title": "Internal", "isListed": false,
                           "jobUrl": "https://jobs.ashbyhq.com/sarvam/hidden"}
                        ]}
                        """, MediaType.APPLICATION_JSON));

        List<JobPosting> jobs = client.fetch(JobBoard.parse("ashby:sarvam:Sarvam AI"));

        assertThat(jobs).singleElement().satisfies(job -> {
            assertThat(job.id()).isEqualTo("ashby-sarvam-c0406fe0");
            assertThat(job.company()).isEqualTo("Sarvam AI");
            assertThat(job.department()).isEqualTo("Research");
            // workplaceType missing, but isRemote=true
            assertThat(job.workplaceType()).isEqualTo(WorkplaceType.REMOTE);
            assertThat(job.postedAt()).isEqualTo(Instant.parse("2026-04-17T11:46:39.214Z"));
            assertThat(job.source()).isEqualTo("Ashby");
        });
        server.verify();
    }
}
