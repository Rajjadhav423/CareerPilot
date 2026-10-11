package com.careerpilot.backend.drive;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Keyed by the owner's user id, so a user only ever loads their own settings. */
interface DriveSettingsRepository extends JpaRepository<DriveSettings, UUID> {
}
