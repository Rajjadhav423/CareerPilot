package com.careerpilot.backend.discovery.client;

import java.util.List;
import java.util.Locale;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.careerpilot.backend.discovery.BoardProvider;
import com.careerpilot.backend.discovery.JobBoard;
import com.careerpilot.backend.discovery.JobPosting;
import com.careerpilot.backend.discovery.WorkplaceType;

/** https://developers.greenhouse.io/job-board.html */
@Component
class GreenhouseClient implements JobBoardClient {

    private final RestClient restClient;

    GreenhouseClient(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("https://boards-api.greenhouse.io/v1/boards").build();
    }

    @Override
    public BoardProvider provider() {
        return BoardProvider.GREENHOUSE;
    }

    @Override
    public List<JobPosting> fetch(JobBoard board) {
        BoardResponse response = restClient.get()
                .uri("/{slug}/jobs", board.slug())
                .retrieve()
                .body(BoardResponse.class);
        if (response == null || response.jobs() == null) {
            return List.of();
        }
        return response.jobs().stream().map(job -> toPosting(board, job)).toList();
    }

    private JobPosting toPosting(JobBoard board, GreenhouseJob job) {
        String location = job.location() == null ? null : job.location().name();
        // The list endpoint has no workplace field; "Remote" usually appears in the location name.
        WorkplaceType workplace = location != null && location.toLowerCase(Locale.ROOT).contains("remote")
                ? WorkplaceType.REMOTE
                : WorkplaceType.UNSPECIFIED;
        return new JobPosting(
                "greenhouse-" + board.slug() + "-" + job.id(),
                job.title(),
                board.companyName(),
                location,
                null,
                workplace,
                job.absoluteUrl(),
                Timestamps.parse(job.firstPublished() != null ? job.firstPublished() : job.updatedAt()),
                BoardProvider.GREENHOUSE.displayName(),
                null);
    }

    record BoardResponse(List<GreenhouseJob> jobs) {
    }

    record GreenhouseJob(
            long id,
            String title,
            Location location,
            @JsonProperty("absolute_url") String absoluteUrl,
            @JsonProperty("first_published") String firstPublished,
            @JsonProperty("updated_at") String updatedAt) {
    }

    record Location(String name) {
    }
}
