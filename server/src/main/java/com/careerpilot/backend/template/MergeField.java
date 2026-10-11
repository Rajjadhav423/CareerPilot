package com.careerpilot.backend.template;

import java.util.Arrays;
import java.util.Optional;

/**
 * The only placeholders a template may contain, written as {@code {{key}}}.
 * Anything else is rejected when a template is saved and blocks sending.
 * {@code sample} values are used for previews only, never for real emails.
 */
public enum MergeField {
    CANDIDATE_NAME("candidate_name", "Your name", "Your name from your account", "Priya Sharma"),
    CANDIDATE_EMAIL("candidate_email", "Your email", "Your account email address", "priya@example.com"),
    RESUME_URL("resume_url", "Resume link",
            "Link to your resume (not available yet: the resume library comes later)",
            "https://example.com/priya-sharma-resume.pdf"),
    JOB_TITLE("job_title", "Job title", "Title of the selected job", "Backend Engineer"),
    COMPANY_NAME("company_name", "Company", "Company of the selected job", "Northwind Labs"),
    JOB_LOCATION("job_location", "Job location", "Location of the selected job", "Bengaluru"),
    JOB_URL("job_url", "Job posting link", "The job's link", "https://jobs.example.com/backend-engineer"),
    APPLICATION_URL("application_url", "Application link",
            "Where to apply: the job's link (CareerPilot stores one link per job)",
            "https://jobs.example.com/backend-engineer"),
    APPLICATION_DATE("application_date", "Application date",
            "The date the application was sent, or today when composing a new one", "11 October 2026");

    private final String key;
    private final String label;
    private final String description;
    private final String sample;

    MergeField(String key, String label, String description, String sample) {
        this.key = key;
        this.label = label;
        this.description = description;
        this.sample = sample;
    }

    public String key() {
        return key;
    }

    public String label() {
        return label;
    }

    public String description() {
        return description;
    }

    public String sample() {
        return sample;
    }

    public String placeholder() {
        return "{{" + key + "}}";
    }

    public static Optional<MergeField> fromKey(String key) {
        return Arrays.stream(values()).filter(field -> field.key.equals(key)).findFirst();
    }
}
