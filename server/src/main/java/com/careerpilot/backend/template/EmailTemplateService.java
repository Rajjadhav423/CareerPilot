package com.careerpilot.backend.template;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.template.EmailTemplateDtos.PreviewResponse;
import com.careerpilot.backend.template.EmailTemplateDtos.TemplateRequest;

/** A user's email templates. Every method takes the owner's id; other users' templates behave as if absent. */
@Service
public class EmailTemplateService {

    /** Generous for personal use; stops runaway creation. */
    static final int MAX_TEMPLATES_PER_USER = 100;

    private static final UUID NO_TEMPLATE = new UUID(0, 0);

    private final EmailTemplateRepository templates;

    public EmailTemplateService(EmailTemplateRepository templates) {
        this.templates = templates;
    }

    @Transactional(readOnly = true)
    public List<EmailTemplate> list(UUID userId) {
        return templates.findAllByUserIdOrderByDefaultTemplateDescNameAsc(userId);
    }

    @Transactional(readOnly = true)
    public EmailTemplate get(UUID userId, UUID templateId) {
        return templates.findByIdAndUserId(templateId, userId).orElseThrow(EmailTemplateService::notFound);
    }

    @Transactional(readOnly = true)
    public Optional<EmailTemplate> findDefault(UUID userId) {
        return templates.findFirstByUserIdAndDefaultTemplateTrue(userId);
    }

    @Transactional
    public EmailTemplate create(UUID userId, TemplateRequest request) {
        requireBelowLimit(userId);
        requireOnlyAllowlistedPlaceholders(request.subject(), request.body());
        if (request.isDefault()) {
            templates.clearDefaultExcept(userId, NO_TEMPLATE);
        }
        EmailTemplate template = new EmailTemplate(userId, request.name().trim(), request.subject().trim(),
                request.body());
        template.setDefaultTemplate(request.isDefault());
        return templates.saveAndFlush(template);
    }

    @Transactional
    public EmailTemplate update(UUID userId, UUID templateId, TemplateRequest request) {
        EmailTemplate template = get(userId, templateId);
        requireOnlyAllowlistedPlaceholders(request.subject(), request.body());
        if (request.isDefault()) {
            templates.clearDefaultExcept(userId, template.getId());
        }
        template.update(request.name().trim(), request.subject().trim(), request.body());
        template.setDefaultTemplate(request.isDefault());
        return templates.saveAndFlush(template);
    }

    /** Copies a template ("Copy of …"); the copy is never the default. */
    @Transactional
    public EmailTemplate duplicate(UUID userId, UUID templateId) {
        requireBelowLimit(userId);
        EmailTemplate original = get(userId, templateId);
        String name = "Copy of " + original.getName();
        EmailTemplate copy = new EmailTemplate(userId, name.length() > 100 ? name.substring(0, 100) : name,
                original.getSubject(), original.getBody());
        return templates.saveAndFlush(copy);
    }

    @Transactional
    public void delete(UUID userId, UUID templateId) {
        templates.delete(get(userId, templateId));
    }

    /** Fills every merge field with sample data, for the template editor's preview. */
    public PreviewResponse preview(String subject, String body) {
        Map<MergeField, String> samples = new EnumMap<>(MergeField.class);
        Arrays.stream(MergeField.values()).forEach(field -> samples.put(field, field.sample()));
        MergeFields.Resolution resolvedSubject = MergeFields.resolve(subject == null ? "" : subject, samples);
        MergeFields.Resolution resolvedBody = MergeFields.resolve(body == null ? "" : body, samples);
        Set<String> unknown = new LinkedHashSet<>(resolvedSubject.unknown());
        unknown.addAll(resolvedBody.unknown());
        return new PreviewResponse(resolvedSubject.text(), resolvedBody.text(), new ArrayList<>(unknown));
    }

    private void requireBelowLimit(UUID userId) {
        if (templates.countByUserId(userId) >= MAX_TEMPLATES_PER_USER) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TEMPLATE_LIMIT_REACHED",
                    "You can keep up to " + MAX_TEMPLATES_PER_USER + " templates. Delete one to add another.");
        }
    }

    private static void requireOnlyAllowlistedPlaceholders(String subject, String body) {
        Set<String> invalid = new LinkedHashSet<>(MergeFields.invalidPlaceholders(subject));
        invalid.addAll(MergeFields.invalidPlaceholders(body));
        if (!invalid.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNKNOWN_PLACEHOLDERS",
                    "These placeholders aren't supported: " + String.join(", ", invalid)
                            + ". Use the merge field menu to insert supported fields.");
        }
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "TEMPLATE_NOT_FOUND", "Template not found.");
    }
}
