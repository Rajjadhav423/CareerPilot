package com.careerpilot.backend.template;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

class MergeFieldsTest {

    @Test
    void fillsAllowlistedFieldsAndToleratesSpacesInsideBraces() {
        Map<MergeField, String> values = new EnumMap<>(MergeField.class);
        values.put(MergeField.JOB_TITLE, "Backend Engineer");
        values.put(MergeField.COMPANY_NAME, "CRED");

        var result = MergeFields.resolve("Applying for {{job_title}} at {{ company_name }}", values);

        assertThat(result.text()).isEqualTo("Applying for Backend Engineer at CRED");
        assertThat(result.missing()).isEmpty();
        assertThat(result.unknown()).isEmpty();
    }

    @Test
    void missingValuesStayAsPlaceholdersAndAreReported() {
        Map<MergeField, String> values = new EnumMap<>(MergeField.class);
        values.put(MergeField.CANDIDATE_NAME, "Raj");
        values.put(MergeField.RESUME_URL, "   ");

        var result = MergeFields.resolve("{{candidate_name}} {{resume_url}} {{job_location}}", values);

        assertThat(result.text()).isEqualTo("Raj {{resume_url}} {{job_location}}");
        assertThat(result.missing()).containsExactlyInAnyOrder(MergeField.RESUME_URL, MergeField.JOB_LOCATION);
    }

    @Test
    void unknownAndMalformedPlaceholdersAreFlaggedNotEvaluated() {
        var result = MergeFields.resolve("Hi {{name}} {{ 7*7 }} ${jndi:x} {{job_title", Map.of());

        assertThat(result.text()).contains("{{name}}").contains("{{ 7*7 }}").contains("${jndi:x}");
        assertThat(result.unknown()).containsExactly("{{name}}", "{{ 7*7 }}", "{{");
    }

    @Test
    void valuesAreInsertedLiterallyEvenIfTheyLookLikePlaceholdersOrRegex() {
        Map<MergeField, String> values = new EnumMap<>(MergeField.class);
        values.put(MergeField.COMPANY_NAME, "$1 {{job_title}} \\ <b>Acme</b>");

        var result = MergeFields.resolve("{{company_name}}", values);

        assertThat(result.text()).isEqualTo("$1 {{job_title}} \\ <b>Acme</b>");
    }

    @Test
    void invalidPlaceholdersListsOnlyNonAllowlisted() {
        assertThat(MergeFields.invalidPlaceholders("{{job_title}} {{salary}} }}")).containsExactly("{{salary}}", "}}");
        assertThat(MergeFields.invalidPlaceholders("Dear hiring team, {{candidate_name}}")).isEmpty();
    }

    @Test
    void remainingPlaceholdersFindsAnythingThatWouldBlockSending() {
        assertThat(MergeFields.remainingPlaceholders("All filled in.")).isEmpty();
        assertThat(MergeFields.remainingPlaceholders("Link: {{resume_url}}")).containsExactly("{{resume_url}}");
        assertThat(MergeFields.remainingPlaceholders("broken {{ thing")).containsExactly("{{");
    }

    @Test
    void longUnclosedInputIsHandledQuickly() {
        String hostile = "{{" + " ".repeat(20_000);
        long start = System.nanoTime();
        MergeFields.remainingPlaceholders(hostile);
        assertThat(System.nanoTime() - start).isLessThan(1_000_000_000L);
    }
}
