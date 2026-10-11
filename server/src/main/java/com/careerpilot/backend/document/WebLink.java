package com.careerpilot.backend.document;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/** An optional http(s) link that may be printed into a document; see {@link SafeUrls#webLink(String)}. */
@Documented
@Constraint(validatedBy = WebLink.Validator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT, ElementType.TYPE_USE })
@Retention(RetentionPolicy.RUNTIME)
public @interface WebLink {

    String message() default "must be a web address starting with http:// or https://";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<WebLink, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            return SafeUrls.isAcceptableWebLink(value);
        }
    }
}
