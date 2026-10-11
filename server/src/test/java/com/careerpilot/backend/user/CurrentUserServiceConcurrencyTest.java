package com.careerpilot.backend.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import com.careerpilot.backend.user.CurrentUserService.ClerkProfile;

/**
 * Clerk delivers user.created and session.created at the same moment for every sign-up.
 * Both must end up in ONE row with the profile AND the sign-in time, and no request may fail.
 */
@SpringBootTest
class CurrentUserServiceConcurrencyTest {

    @Autowired
    private CurrentUserService currentUsers;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        jdbc.execute("truncate table users cascade");
    }

    @RepeatedTest(10)
    void simultaneousSignUpAndSignInWebhooksMergeIntoOneRow() throws Exception {
        String clerkId = "user_race_" + System.nanoTime();
        Instant signedInAt = Instant.parse("2026-10-11T06:39:34Z");
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService pool = Executors.newFixedThreadPool(3)) {
            List<Future<User>> results = List.of(
                    pool.submit(() -> {
                        start.await();
                        return currentUsers.upsertFromClerk(clerkId,
                                new ClerkProfile("race@example.com", "Race Test", "https://img/race.png"));
                    }),
                    pool.submit(() -> {
                        start.await();
                        return currentUsers.recordSignIn(clerkId, signedInAt);
                    }),
                    pool.submit(() -> {
                        start.await();
                        return currentUsers.upsertFromClerk(clerkId, new ClerkProfile(null, null, null));
                    }));
            start.countDown();
            for (Future<User> result : results) {
                assertThat(result.get()).isNotNull();
            }
        }

        assertThat(users.count()).isEqualTo(1);
        User user = users.findByClerkUserId(clerkId).orElseThrow();
        assertThat(user.getEmail()).isEqualTo("race@example.com");
        assertThat(user.getDisplayName()).isEqualTo("Race Test");
        assertThat(user.getLastSignedInAt()).isEqualTo(signedInAt);
    }
}
