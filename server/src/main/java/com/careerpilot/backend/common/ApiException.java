package com.careerpilot.backend.common;

import org.springframework.http.HttpStatus;

/**
 * An expected failure with a status and a stable {@code code} the frontend can switch on,
 * e.g. 403 EMAIL_NOT_VERIFIED. Rendered as a ProblemDetail by {@link GlobalExceptionHandler}.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
