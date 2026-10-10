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

@RestClientTest(LeverClient.class)
class LeverClientTest {

    @Autowired
    private LeverClient client;

    @Autowired
    private MockRestServiceServer server;

    @Test
    void mapsLeverPostings() {
        server.expect(requestTo("https://api.lever.co/v0/postings/cred?mode=json"))
                .andRespond(withSuccess("""
                        [{"id": "aa98a938", "text": "Backend Engineer",
                          "categories": {"location": "Bengaluru", "team": "Engineering", "commitment": "full time"},
                          "createdAt": 1790573982021, "workplaceType": "hybrid",
                          "hostedUrl": "https://jobs.lever.co/cred/aa98a938",
                          "descriptionPlain": "ignored"}]
                        """, MediaType.APPLICATION_JSON));

        List<JobPosting> jobs = client.fetch(JobBoard.parse("lever:cred:CRED"));

        assertThat(jobs).singleElement().satisfies(job -> {
            assertThat(job.id()).isEqualTo("lever-cred-aa98a938");
            assertThat(job.title()).isEqualTo("Backend Engineer");
            assertThat(job.company()).isEqualTo("CRED");
            assertThat(job.location()).isEqualTo("Bengaluru");
            assertThat(job.department()).isEqualTo("Engineering");
            assertThat(job.workplaceType()).isEqualTo(WorkplaceType.HYBRID);
            assertThat(job.url()).isEqualTo("https://jobs.lever.co/cred/aa98a938");
            assertThat(job.postedAt()).isEqualTo(Instant.ofEpochMilli(1790573982021L));
            assertThat(job.source()).isEqualTo("Lever");
        });
        server.verify();
    }
}
