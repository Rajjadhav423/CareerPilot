package com.careerpilot.backend.user;

import java.time.Clock;
import java.time.Instant;
import java.util.function.Supplier;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Keeps our users table in step with Clerk.
 * <ul>
 *   <li>Clerk webhooks (main path): {@link #upsertFromClerk}, {@link #recordSignIn}, {@link #deleteFromClerk}</li>
 *   <li>{@link #resolve}: any authenticated API call; creates the row if its webhook hasn't arrived yet</li>
 * </ul>
 * Profile claims in the session token come from Clerk's "Customize session token" setting:
 * {@code {"email": "{{user.primary_email_address}}", "name": "{{user.full_name}}", "picture": "{{user.image_url}}"}}.
 */
@Service
public class CurrentUserService {

    public record ClerkProfile(String email, String name, String picture) {

        static ClerkProfile from(Jwt jwt) {
            return new ClerkProfile(jwt.getClaimAsString("email"), jwt.getClaimAsString("name"),
                    jwt.getClaimAsString("picture"));
        }
    }

    private final UserRepository users;
    private final TransactionTemplate transaction;
    private final Clock clock;

    @Autowired
    public CurrentUserService(UserRepository users, TransactionTemplate transaction) {
        this(users, transaction, Clock.systemUTC());
    }

    CurrentUserService(UserRepository users, TransactionTemplate transaction, Clock clock) {
        this.users = users;
        this.transaction = transaction;
        this.clock = clock;
    }

    /** The user behind an authenticated request. */
    public User resolve(Jwt jwt) {
        return inTransaction(() -> findOrCreate(jwt.getSubject(), ClerkProfile.from(jwt)));
    }

    /** From a Clerk "user.created" / "user.updated" webhook. */
    public User upsertFromClerk(String clerkUserId, ClerkProfile profile) {
        return inTransaction(() -> findOrCreate(clerkUserId, profile));
    }

    /** From a Clerk "session.created" webhook (a sign-in). Profile details arrive with user.created/updated. */
    public User recordSignIn(String clerkUserId, Instant signedInAt) {
        return inTransaction(() -> {
            User user = findOrCreate(clerkUserId, new ClerkProfile(null, null, null));
            user.recordSignIn(signedInAt == null ? clock.instant() : signedInAt);
            return user;
        });
    }

    /** From a Clerk "user.deleted" webhook. Their data goes with them (foreign keys cascade). */
    public boolean deleteFromClerk(String clerkUserId) {
        return Boolean.TRUE.equals(transaction.execute(status -> users.deleteByClerkUserId(clerkUserId) > 0));
    }

    private User findOrCreate(String clerkUserId, ClerkProfile profile) {
        User user = users.findByClerkUserId(clerkUserId).orElseGet(() -> {
            // Atomic "create if missing": safe when several webhooks/requests arrive at once.
            users.insertIfAbsent(clerkUserId);
            return users.findByClerkUserId(clerkUserId).orElseThrow();
        });
        user.updateProfile(profile.email(), profile.name(), profile.picture());
        return user;
    }

    private User inTransaction(Supplier<User> work) {
        return transaction.execute(status -> work.get());
    }
}
