package com.careerpilot.backend.discovery;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.careerpilot.backend.discovery.DiscoverResponse.SourceStatus;
import com.careerpilot.backend.discovery.client.JobBoardClient;

/**
 * Fetches all configured job boards in parallel, keeps only tech jobs, caches the merged result and searches it.
 * One failing board never breaks the others; its error is reported in {@link SourceStatus}.
 */
@Service
public class DiscoveryService {

    static final int MAX_LIMIT = 500;

    private static final Logger log = LoggerFactory.getLogger(DiscoveryService.class);
    private static final Comparator<JobPosting> NEWEST_FIRST =
            Comparator.comparing(JobPosting::postedAt, Comparator.nullsLast(Comparator.reverseOrder()));

    private final Map<BoardProvider, JobBoardClient> clients = new EnumMap<>(BoardProvider.class);
    private final List<JobBoard> boards;
    private final Duration cacheTtl;
    private final Clock clock;

    private Snapshot snapshot;

    @Autowired
    public DiscoveryService(List<JobBoardClient> clients, DiscoveryProperties properties) {
        this(clients, properties, Clock.systemUTC());
    }

    DiscoveryService(List<JobBoardClient> clients, DiscoveryProperties properties, Clock clock) {
        clients.forEach(client -> this.clients.put(client.provider(), client));
        this.boards = properties.boards().stream().map(JobBoard::parse).toList();
        this.cacheTtl = properties.cacheTtl();
        this.clock = clock;
    }

    /** @param role only this kind of tech job, or null for all tech jobs */
    public DiscoverResponse search(String query, String location, TechRole role, int limit, boolean refresh) {
        Snapshot current = currentSnapshot(refresh);
        List<String> terms = words(query);
        String place = normalise(location);

        List<JobPosting> queryMatches = current.jobs().stream()
                .filter(job -> matchesTerms(job, terms))
                .filter(job -> matchesLocation(job, place))
                .toList();
        Map<TechRole, Long> roleCounts = queryMatches.stream()
                .collect(Collectors.groupingBy(JobPosting::techRole, () -> new EnumMap<>(TechRole.class),
                        Collectors.counting()));
        List<JobPosting> matches = role == null
                ? queryMatches
                : queryMatches.stream().filter(job -> job.techRole() == role).toList();

        int safeLimit = Math.clamp(limit, 1, MAX_LIMIT);
        return new DiscoverResponse(matches.stream().limit(safeLimit).toList(), matches.size(), roleCounts,
                current.fetchedAt(), current.sources());
    }

    private synchronized Snapshot currentSnapshot(boolean refresh) {
        Instant now = clock.instant();
        if (refresh || snapshot == null || snapshot.fetchedAt().plus(cacheTtl).isBefore(now)) {
            snapshot = fetchAll(now);
        }
        return snapshot;
    }

    private Snapshot fetchAll(Instant now) {
        List<Future<BoardResult>> futures;
        // Virtual threads: each board is one blocking HTTP call, so fetch them all at once.
        // Closing the executor waits for every fetch, so results are read after the try block.
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            futures = boards.stream()
                    .map(board -> executor.submit(() -> fetchBoard(board)))
                    .toList();
        }
        List<BoardResult> results = futures.stream().map(Future::resultNow).toList();

        List<JobPosting> jobs = new ArrayList<>();
        List<SourceStatus> sources = new ArrayList<>();
        for (BoardResult result : results) {
            jobs.addAll(result.jobs());
            sources.add(result.status());
        }
        jobs.sort(NEWEST_FIRST);
        log.info("Fetched {} tech job postings from {} boards", jobs.size(), boards.size());
        return new Snapshot(List.copyOf(jobs), List.copyOf(sources), now);
    }

    private BoardResult fetchBoard(JobBoard board) {
        JobBoardClient client = clients.get(board.provider());
        String provider = board.provider().displayName();
        if (client == null) {
            return BoardResult.failed(board, "No client for provider " + provider);
        }
        try {
            List<JobPosting> jobs = client.fetch(board).stream()
                    .map(DiscoveryService::withTechRole)
                    .flatMap(Optional::stream)
                    .toList();
            return new BoardResult(jobs,
                    new SourceStatus(board.label(), board.companyName(), provider, true, jobs.size(), null));
        } catch (RuntimeException e) {
            log.warn("Could not fetch job board {}: {}", board.label(), e.getMessage());
            return BoardResult.failed(board, "Could not fetch this board right now.");
        }
    }

    /** Non-tech postings become empty and are dropped. */
    private static Optional<JobPosting> withTechRole(JobPosting job) {
        return TechRoleClassifier.classify(job.title(), job.department()).map(job::withTechRole);
    }

    private static boolean matchesTerms(JobPosting job, List<String> terms) {
        if (terms.isEmpty()) {
            return true;
        }
        String haystack = normalise(job.title() + " " + job.company() + " " + job.department());
        return terms.stream().allMatch(haystack::contains);
    }

    private static boolean matchesLocation(JobPosting job, String place) {
        if (place.isEmpty()) {
            return true;
        }
        if (place.equals("remote") && job.workplaceType() == WorkplaceType.REMOTE) {
            return true;
        }
        return normalise(job.location()).contains(place);
    }

    private static List<String> words(String text) {
        return Arrays.stream(normalise(text).split("\\s+")).filter(word -> !word.isEmpty()).toList();
    }

    private static String normalise(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT).trim();
    }

    private record Snapshot(List<JobPosting> jobs, List<SourceStatus> sources, Instant fetchedAt) {
    }

    private record BoardResult(List<JobPosting> jobs, SourceStatus status) {

        static BoardResult failed(JobBoard board, String error) {
            return new BoardResult(List.of(), new SourceStatus(
                    board.label(), board.companyName(), board.provider().displayName(), false, 0, error));
        }
    }
}
