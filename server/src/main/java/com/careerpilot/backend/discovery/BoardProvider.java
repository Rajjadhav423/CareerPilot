package com.careerpilot.backend.discovery;

/** Applicant-tracking systems whose public job-board APIs we read. */
public enum BoardProvider {
    GREENHOUSE("Greenhouse"),
    LEVER("Lever"),
    ASHBY("Ashby");

    private final String displayName;

    BoardProvider(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }
}
