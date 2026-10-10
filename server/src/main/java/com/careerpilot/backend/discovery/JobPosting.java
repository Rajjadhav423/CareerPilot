package com.careerpilot.backend.discovery;

import java.time.Instant;

/**
 * A job opening found on a public job board, normalised to one shape for all providers.
 * Not stored: it becomes a tracked Job only when the user saves it.
 *
 * @param techRole set by {@link DiscoveryService}; clients leave it null
 */
public record JobPosting(
        String id,
        String title,
        String company,
        String location,
        String department,
        WorkplaceType workplaceType,
        String url,
        Instant postedAt,
        String source,
        TechRole techRole) {

    public JobPosting withTechRole(TechRole role) {
        return new JobPosting(id, title, company, location, department, workplaceType, url, postedAt, source, role);
    }
}
