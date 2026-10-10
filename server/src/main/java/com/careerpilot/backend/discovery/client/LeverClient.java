package com.careerpilot.backend.discovery.client;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.careerpilot.backend.discovery.BoardProvider;
import com.careerpilot.backend.discovery.JobBoard;
import com.careerpilot.backend.discovery.JobPosting;
import com.careerpilot.backend.discovery.WorkplaceType;

/** https://github.com/lever/postings-api */
@Component
class LeverClient implements JobBoardClient {

    private final RestClient restClient;

    LeverClient(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("https://api.lever.co/v0/postings").build();
    }

    @Override
    public BoardProvider provider() {
        return BoardProvider.LEVER;
    }

    @Override
    public List<JobPosting> fetch(JobBoard board) {
        LeverJob[] jobs = restClient.get()
                .uri("/{slug}?mode=json", board.slug())
                .retrieve()
                .body(LeverJob[].class);
        if (jobs == null) {
            return List.of();
        }
        return Arrays.stream(jobs).map(job -> toPosting(board, job)).toList();
    }

    private JobPosting toPosting(JobBoard board, LeverJob job) {
        Categories categories = job.categories() != null ? job.categories() : new Categories(null, null, null);
        return new JobPosting(
                "lever-" + board.slug() + "-" + job.id(),
                job.text(),
                board.companyName(),
                categories.location(),
                categories.team() != null ? categories.team() : categories.department(),
                WorkplaceType.from(job.workplaceType()),
                job.hostedUrl(),
                job.createdAt() == null ? null : Instant.ofEpochMilli(job.createdAt()),
                BoardProvider.LEVER.displayName(),
                null);
    }

    record LeverJob(String id, String text, Categories categories, Long createdAt, String workplaceType,
            String hostedUrl) {
    }

    record Categories(String location, String team, String department) {
    }
}
