package com.careerpilot.backend.drive;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/** Every query takes the owner's id: another user's document behaves exactly like a missing one. */
interface DriveDocumentRepository extends JpaRepository<DriveDocument, UUID> {

    Optional<DriveDocument> findByIdAndUserId(UUID id, UUID userId);

    Optional<DriveDocument> findByUserIdAndRequestId(UUID userId, UUID requestId);

    Optional<DriveDocument> findByUserIdAndDriveFileId(UUID userId, String driveFileId);

    List<DriveDocument> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);

    @Modifying
    @Query("delete from DriveDocument d where d.userId = :userId")
    void deleteAllOwnedBy(UUID userId);
}
