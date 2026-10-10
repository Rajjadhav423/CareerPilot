package com.careerpilot.backend.discovery.client;

import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.careerpilot.backend.discovery.BoardProvider;
import com.careerpilot.backend.discovery.JobBoard;
import com.careerpilot.backend.discovery.JobPosting;
import com.careerpilot.backend.discovery.WorkplaceType;

/** https://developers.ashbyhq.com/docs/public-job-posting-api */
@Component
class AshbyClient implements JobBoardClient {

    private final RestClient restClient;

    AshbyClient(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("https://api.ashbyhq.com/posting-api/job-board").build();
    }

    @Override
    public BoardProvider provider() {
        return BoardProvider.ASHBY;
    }

    @Override
    public List<JobPosting> fetch(JobBoard board) {
        BoardResponse response = restClient.get()
                .uri("/{slug}", board.slug())
                .retrieve()
                .body(BoardResponse.class);
        if (response == null || response.jobs() == null) {
            return List.of();
        }
        return response.jobs().stream()
                .filter(job -> !Boolean.FALSE.equals(job.isListed()))
                .map(job -> toPosting(board, job))
                .toList();
    }

    private JobPosting toPosting(JobBoard board, AshbyJob job) {
        WorkplaceType workplace = WorkplaceType.from(job.workplaceType());
        if (workplace == WorkplaceType.UNSPECIFIED && Boolean.TRUE.equals(job.isRemote())) {
            workplace = WorkplaceType.REMOTE;
        }
        return new JobPosting(
                "ashby-" + board.slug() + "-" + job.id(),
                job.title(),
                board.companyName(),
                job.location(),
                job.department(),
                workplace,
                job.jobUrl(),
                Timestamps.parse(job.publishedAt()),
                BoardProvider.ASHBY.displayName(),
                null);
    }

    record BoardResponse(List<AshbyJob> jobs) {
    }

    record AshbyJob(String id, String title, String department, String location, String publishedAt,
            Boolean isListed, Boolean isRemote, String workplaceType, String jobUrl) {
    }
}
