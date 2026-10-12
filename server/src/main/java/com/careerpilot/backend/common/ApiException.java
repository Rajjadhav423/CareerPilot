package com.careerpilot.backend.common;

import java.util.Map;

import org.springframework.http.HttpStatus;

/**
 * An expected failure with a status and a stable {@code code} the frontend can switch on,
 * e.g. 403 EMAIL_NOT_VERIFIED. Rendered as a ProblemDetail by {@link GlobalExceptionHandler}.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, Object> details;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, Map.of());
    }

    /** @param details extra ProblemDetail properties, e.g. {@code issues} for a rejected document */
    public ApiException(HttpStatus status, String code, String message, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = Map.copyOf(details);
    }

    public Map<String, Object> details() {
        return details;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
