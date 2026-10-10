package com.careerpilot.backend.discovery;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * @param jobs       matching postings, newest first, at most {@code limit}
 * @param total      number of matches before the limit was applied
 * @param roleCounts matches per tech role for the current query and location (ignoring the role filter)
 * @param fetchedAt  when the boards were last fetched (results are cached)
 * @param sources    per-board outcome, so the UI can say which boards failed
 */
public record DiscoverResponse(
        List<JobPosting> jobs,
        int total,
        Map<TechRole, Long> roleCounts,
        Instant fetchedAt,
        List<SourceStatus> sources) {

    /** @param count tech jobs kept from this board (non-tech postings are dropped) */
    public record SourceStatus(String board, String company, String provider, boolean ok, int count, String error) {
    }
}
