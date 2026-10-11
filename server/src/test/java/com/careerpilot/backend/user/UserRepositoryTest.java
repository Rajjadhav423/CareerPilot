package com.careerpilot.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;

/** Runs against the real careerpilot_test PostgreSQL database, migrated by Flyway. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserRepositoryTest {

    @Autowired
    private UserRepository users;

    @Test
    void savesClerkUserWithNormalisedEmailAndTimestamps() {
        User saved = users.saveAndFlush(User.fromClerk("user_abc", "  Raj@Example.COM ", "Raj", "https://img/raj.png"));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getEmail()).isEqualTo("raj@example.com");
        assertThat(saved.getCreatedAt()).isNotNull().isEqualTo(saved.getUpdatedAt());
        assertThat(users.findByClerkUserId("user_abc")).contains(saved);
    }

    @Test
    void clerkUserIdMustBeUnique() {
        users.saveAndFlush(User.fromClerk("user_same", "a@example.com", null, null));

        assertThatThrownBy(() -> users.saveAndFlush(User.fromClerk("user_same", "b@example.com", null, null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void userWithoutProfileClaimsIsAllowed() {
        User saved = users.saveAndFlush(User.fromClerk("user_bare", null, null, null));

        assertThat(saved.getEmail()).isNull();
    }

    @Test
    void updateProfileKeepsExistingValuesWhenClaimMissing() {
        User user = User.fromClerk("user_x", "x@example.com", "Old Name", null);

        assertThat(user.updateProfile(null, "New Name", null)).isTrue();
        assertThat(user.getEmail()).isEqualTo("x@example.com");
        assertThat(user.getDisplayName()).isEqualTo("New Name");
        assertThat(user.updateProfile("X@EXAMPLE.com", "New Name", null)).isFalse();
    }
}
