package com.careerpilot.backend.resume;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.careerpilot.backend.document.DocumentTemplate;

/**
 * The resume layouts users can pick. All are single-column with real text and standard headings, which
 * applicant tracking systems read reliably. To add one: create documents/templates/resume/&lt;id&gt;.xhtml and
 * documents/css/resume-&lt;id&gt;.css, then register it here.
 */
@Component
public class ResumeTemplates {

    public static final String DEFAULT_ID = "classic";

    private final Map<String, DocumentTemplate> templates = new LinkedHashMap<>();

    public ResumeTemplates() {
        register(new DocumentTemplate("classic", "Classic",
                "Serif type, centered header and ruled sections. A safe choice for any role.",
                "resume/classic", "resume-classic"));
        register(new DocumentTemplate("modern", "Modern",
                "Clean sans-serif with a blue accent. Works well for tech roles.",
                "resume/modern", "resume-modern"));
    }

    private void register(DocumentTemplate template) {
        templates.put(template.id(), template);
    }

    public List<DocumentTemplate> all() {
        return List.copyOf(templates.values());
    }

    public Optional<DocumentTemplate> find(String id) {
        return Optional.ofNullable(id == null ? null : templates.get(id));
    }
}
