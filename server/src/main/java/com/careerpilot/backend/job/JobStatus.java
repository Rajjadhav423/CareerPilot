package com.careerpilot.backend.job;

/** Board columns, in order. Same ids as the frontend's lib/jobs/statuses.ts. */
public enum JobStatus {
    SAVED,
    TO_REVIEW,
    PREPARING,
    APPLIED,
    INTERVIEW,
    OFFER,
    REJECTED,
    CLOSED
}
