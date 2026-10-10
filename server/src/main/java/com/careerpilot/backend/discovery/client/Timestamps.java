package com.careerpilot.backend.discovery.client;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

final class Timestamps {

    private Timestamps() {
    }

    /** Parses ISO-8601 with offset (e.g. "2026-09-14T03:49:28-04:00"); null when missing or malformed. */
    static Instant parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
