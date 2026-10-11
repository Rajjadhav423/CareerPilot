package com.careerpilot.backend.resume;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Every query takes the owner's id, so one user can never load another user's versions. */
interface ResumeVersionRepository extends JpaRepository<ResumeVersion, UUID> {

    Optional<ResumeVersion> findByIdAndResumeIdAndUserId(UUID id, UUID resumeId, UUID userId);

    List<ResumeVersion> findAllByResumeIdAndUserIdOrderByNumberDesc(UUID resumeId, UUID userId);

    long countByResumeIdAndStatus(UUID resumeId, ResumeVersion.Status status);

    @Query("select coalesce(max(v.number), 0) from ResumeVersion v where v.resumeId = :resumeId")
    int maxNumber(UUID resumeId);
}
