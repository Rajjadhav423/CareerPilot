package com.careerpilot.backend.discovery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import com.careerpilot.backend.discovery.client.JobBoardClient;

class DiscoveryServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-11T10:00:00Z");

    private final MutableClock clock = new MutableClock(NOW);
    private final FakeClient greenhouse = new FakeClient(BoardProvider.GREENHOUSE, List.of(
            posting("1", "Senior Backend Engineer", "Groww", "Bengaluru, India", WorkplaceType.ONSITE, "2026-10-01T00:00:00Z"),
            posting("2", "Frontend Engineer", "Groww", "Remote - India", WorkplaceType.REMOTE, "2026-10-05T00:00:00Z"),
            posting("5", "Account Executive", "Groww", "Mumbai", WorkplaceType.ONSITE, "2026-10-10T00:00:00Z")));
    private final FakeClient lever = new FakeClient(BoardProvider.LEVER, List.of(
            posting("3", "Backend Engineer, Payments", "CRED", "Bengaluru", WorkplaceType.HYBRID, null),
            posting("4", "Android Developer", "CRED", "Mumbai", WorkplaceType.ONSITE, "2026-10-09T00:00:00Z")));

    private DiscoveryService service(String... boards) {
        return new DiscoveryService(List.of(greenhouse, lever),
                new DiscoveryProperties(List.of(boards), Duration.ofMinutes(15)), clock);
    }

    @Test
    void keepsOnlyTechJobsMergedNewestFirstWithUndatedLast() {
        DiscoverResponse response = service("greenhouse:groww:Groww", "lever:cred:CRED").search("", "", null, 100, false);

        // "Account Executive" (id 5) is dropped even though it is the newest posting
        assertThat(response.jobs()).extracting(JobPosting::id).containsExactly("4", "2", "1", "3");
        assertThat(response.jobs()).extracting(JobPosting::techRole)
                .containsExactly(TechRole.MOBILE, TechRole.FRONTEND, TechRole.BACKEND, TechRole.BACKEND);
        assertThat(response.total()).isEqualTo(4);
        assertThat(response.fetchedAt()).isEqualTo(NOW);
        assertThat(response.sources()).extracting(DiscoverResponse.SourceStatus::count).containsExactly(2, 2);
    }

    @Test
    void roleFilterKeepsCountsForAllRoles() {
        DiscoverResponse response = service("greenhouse:groww:Groww", "lever:cred:CRED")
                .search("", "", TechRole.BACKEND, 100, false);

        assertThat(response.jobs()).extracting(JobPosting::id).containsExactly("1", "3");
        assertThat(response.total()).isEqualTo(2);
        assertThat(response.roleCounts()).containsExactlyInAnyOrderEntriesOf(Map.of(
                TechRole.BACKEND, 2L, TechRole.FRONTEND, 1L, TechRole.MOBILE, 1L));
    }

    @Test
    void queryMatchesAllWordsInTitleCompanyOrDepartment() {
        DiscoverResponse response = service("greenhouse:groww:Groww", "lever:cred:CRED")
                .search("backend ENGINEER", "", null, 100, false);

        assertThat(response.jobs()).extracting(JobPosting::id).containsExactly("1", "3");
        assertThat(service("lever:cred:CRED").search("cred android", "", null, 100, false).jobs())
                .extracting(JobPosting::id).containsExactly("4");
    }

    @Test
    void locationFiltersByTextAndRemoteMatchesRemoteJobs() {
        DiscoveryService service = service("greenhouse:groww:Groww", "lever:cred:CRED");

        assertThat(service.search("", "bengaluru", null, 100, false).jobs()).extracting(JobPosting::id)
                .containsExactly("1", "3");
        assertThat(service.search("", "remote", null, 100, false).jobs()).extracting(JobPosting::id)
                .containsExactly("2");
    }

    @Test
    void limitCapsJobsButTotalCountsAllMatches() {
        DiscoverResponse response = service("greenhouse:groww:Groww", "lever:cred:CRED").search("", "", null, 1, false);

        assertThat(response.jobs()).hasSize(1);
        assertThat(response.total()).isEqualTo(4);
    }

    @Test
    void failingBoardIsReportedAndOthersStillReturned() {
        lever.failing = true;

        DiscoverResponse response = service("greenhouse:groww:Groww", "lever:cred:CRED").search("", "", null, 100, false);

        assertThat(response.jobs()).extracting(JobPosting::id).containsExactly("2", "1");
        assertThat(response.sources()).satisfiesExactly(
                ok -> assertThat(ok.ok()).isTrue(),
                failed -> {
                    assertThat(failed.ok()).isFalse();
                    assertThat(failed.board()).isEqualTo("CRED (Lever)");
                    assertThat(failed.error()).isNotBlank();
                });
    }

    @Test
    void resultsAreCachedUntilTtlExpiresOrRefreshIsRequested() {
        DiscoveryService service = service("greenhouse:groww:Groww");

        service.search("", "", null, 100, false);
        service.search("design", "", null, 100, false);
        assertThat(greenhouse.calls.get()).isEqualTo(1);

        service.search("", "", null, 100, true);
        assertThat(greenhouse.calls.get()).isEqualTo(2);

        clock.advance(Duration.ofMinutes(16));
        service.search("", "", null, 100, false);
        assertThat(greenhouse.calls.get()).isEqualTo(3);
    }

    @Test
    void invalidBoardConfigFailsFastWithClearMessage() {
        assertThatThrownBy(() -> service("monster:acme:Acme"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown job board provider 'monster'");
        assertThatThrownBy(() -> service("greenhouse:acme"))
                .hasMessageContaining("Expected format provider:slug:Company Name");
        assertThatThrownBy(() -> service("greenhouse:../../admin:Acme"))
                .hasMessageContaining("Invalid job board slug");
        assertThatThrownBy(() -> service("lever:evil.example.com/x:Acme"))
                .hasMessageContaining("Invalid job board slug");
    }

    private static JobPosting posting(String id, String title, String company, String location,
            WorkplaceType workplace, String postedAt) {
        return new JobPosting(id, title, company, location, null, workplace, "https://example.com/" + id,
                postedAt == null ? null : Instant.parse(postedAt), "Test", null);
    }

    private static final class FakeClient implements JobBoardClient {
        private final BoardProvider provider;
        private final List<JobPosting> jobs;
        private final AtomicInteger calls = new AtomicInteger();
        private volatile boolean failing;

        FakeClient(BoardProvider provider, List<JobPosting> jobs) {
            this.provider = provider;
            this.jobs = jobs;
        }

        @Override
        public BoardProvider provider() {
            return provider;
        }

        @Override
        public List<JobPosting> fetch(JobBoard board) {
            calls.incrementAndGet();
            if (failing) {
                throw new IllegalStateException("boom");
            }
            return jobs;
        }
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
