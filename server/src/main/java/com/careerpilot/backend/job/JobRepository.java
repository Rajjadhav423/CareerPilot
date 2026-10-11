package com.careerpilot.backend.job;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Every query takes the owner's id, so one user can never read or change another user's jobs. */
interface JobRepository extends JpaRepository<Job, UUID> {

    Optional<Job> findByIdAndUserId(UUID id, UUID userId);

    List<Job> findAllByUserIdAndArchivedOrderByUpdatedAtDesc(UUID userId, boolean archived);

    List<Job> findAllByUserIdAndArchivedAndStatusOrderByUpdatedAtDesc(UUID userId, boolean archived, JobStatus status);

    Optional<Job> findByUserIdAndExternalId(UUID userId, String externalId);
}
