package com.careerpilot.backend.document;

/**
 * One way of laying out a document. Adding a template means adding its XHTML view and stylesheet under
 * {@code src/main/resources/documents/} and registering it (e.g. in ResumeTemplates); the engine itself
 * doesn't change.
 *
 * @param id          stable id stored with the user's document, e.g. "classic"
 * @param name        shown in the template picker
 * @param description one line for the picker
 * @param view        Thymeleaf view under documents/templates/, without ".xhtml", e.g. "resume/classic"
 * @param stylesheet  CSS file under documents/css/, without ".css"
 */
public record DocumentTemplate(String id, String name, String description, String view, String stylesheet) {
}
