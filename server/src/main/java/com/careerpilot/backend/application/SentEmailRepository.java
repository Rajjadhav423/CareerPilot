package com.careerpilot.backend.application;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Every query takes the owner's id. */
interface SentEmailRepository extends JpaRepository<SentEmail, UUID> {

    List<SentEmail> findAllByUserIdAndJobIdOrderBySentAtDesc(UUID userId, UUID jobId);
}
