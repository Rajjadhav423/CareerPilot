package com.careerpilot.backend.discovery.client;

import java.util.List;

import com.careerpilot.backend.discovery.BoardProvider;
import com.careerpilot.backend.discovery.JobBoard;
import com.careerpilot.backend.discovery.JobPosting;

/** Reads one provider's public job-board API and maps it to {@link JobPosting}. */
public interface JobBoardClient {

    BoardProvider provider();

    /** @throws RuntimeException if the board can't be fetched; the caller reports it per board. */
    List<JobPosting> fetch(JobBoard board);
}
