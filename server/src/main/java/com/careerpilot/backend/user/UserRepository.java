package com.careerpilot.backend.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByClerkUserId(String clerkUserId);

    long deleteByClerkUserId(String clerkUserId);

    /**
     * Creates an empty row for this Clerk user unless one exists, in one atomic statement.
     * Clerk often delivers user.created and session.created at the same moment; with this they never collide.
     */
    @Modifying
    @Query(value = """
            insert into users (id, clerk_user_id, created_at, updated_at)
            values (gen_random_uuid(), :clerkUserId, now(), now())
            on conflict (clerk_user_id) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(String clerkUserId);
}
