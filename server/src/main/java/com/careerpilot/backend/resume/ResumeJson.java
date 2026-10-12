package com.careerpilot.backend.resume;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.careerpilot.backend.common.ApiException;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads resume JSON in either format: schema version 2 (sections) or the original fixed-section format,
 * which is converted. Used for stored resumes and for JSON that people or AI assistants import.
 */
@Component
public class ResumeJson {

    private final JsonMapper json;

    public ResumeJson(JsonMapper json) {
        this.json = json;
    }

    /** Parses and converts, without bean validation (callers validate where input comes from users). */
    public ResumeData read(String value) {
        try {
            return read(json.readTree(value));
        } catch (JacksonException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESUME_JSON", "That isn't valid resume JSON.");
        }
    }

    public ResumeData read(JsonNode node) {
        if (node == null || !node.isObject()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESUME_JSON", "Resume JSON must be an object.");
        }
        // Accept a whole saved resume ({"data": {...}}) as well as the data itself
        if (!node.has("basics") && node.path("data").isObject()) {
            node = node.get("data");
        }
        try {
            if (isLegacy(node)) {
                return json.treeToValue(node, LegacyResumeData.class).toV2();
            }
            return json.treeToValue(node, ResumeData.class);
        } catch (JacksonException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESUME_JSON",
                    "Some fields have the wrong type. Check the resume JSON format.");
        }
    }

    public String write(ResumeData data) {
        return json.writeValueAsString(data);
    }

    /** A stored docEngine document (null stays null). */
    public JsonNode tree(String value) {
        return value == null ? null : json.readTree(value);
    }

    public String write(JsonNode document) {
        return document == null ? null : json.writeValueAsString(document);
    }

    private static boolean isLegacy(JsonNode node) {
        if (node.has("sections")) {
            return false;
        }
        for (String key : new String[] { "summary", "experience", "education", "skills", "projects", "certifications", "languages" }) {
            if (node.has(key)) {
                return true;
            }
        }
        return false;
    }
}
