package com.careerpilot.backend.template;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/** Every query takes the owner's id, so one user can never read or change another user's templates. */
interface EmailTemplateRepository extends JpaRepository<EmailTemplate, UUID> {

    Optional<EmailTemplate> findByIdAndUserId(UUID id, UUID userId);

    List<EmailTemplate> findAllByUserIdOrderByDefaultTemplateDescNameAsc(UUID userId);

    Optional<EmailTemplate> findFirstByUserIdAndDefaultTemplateTrue(UUID userId);

    long countByUserId(UUID userId);

    /** Clears the user's default flag on every template except {@code keepId}, before setting a new default. */
    @Modifying(flushAutomatically = true)
    @Query("update EmailTemplate t set t.defaultTemplate = false "
            + "where t.userId = :userId and t.defaultTemplate = true and t.id <> :keepId")
    void clearDefaultExcept(UUID userId, UUID keepId);
}
