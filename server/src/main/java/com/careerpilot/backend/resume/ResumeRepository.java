package com.careerpilot.backend.resume;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Every query takes the owner's id, so one user can never load another user's resume. */
interface ResumeRepository extends JpaRepository<Resume, UUID> {

    Optional<Resume> findByIdAndUserId(UUID id, UUID userId);

    List<Resume> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);

    long countByUserId(UUID userId);
}
