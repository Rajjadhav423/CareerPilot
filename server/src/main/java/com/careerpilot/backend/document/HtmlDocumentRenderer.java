package com.careerpilot.backend.document;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * Turns document data into a well-formed XHTML page with the template's stylesheet inlined.
 *
 * Thymeleaf runs in XML mode with its standard expressions only: every value printed with {@code th:text}
 * or into an attribute is escaped, and templates are our own files on the classpath, never user input.
 * The same XHTML is used for the browser preview and as the input to {@link PdfDocumentConverter}.
 */
@Component
public class HtmlDocumentRenderer {

    private static final String BASE_STYLESHEET = "base";

    private final TemplateEngine engine;
    private final Map<String, String> stylesheets = new ConcurrentHashMap<>();

    public HtmlDocumentRenderer() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("documents/templates/");
        resolver.setSuffix(".xhtml");
        resolver.setTemplateMode(TemplateMode.XML);
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resolver.setCacheable(true);
        resolver.setCheckExistence(true);
        this.engine = new TemplateEngine();
        this.engine.setTemplateResolver(resolver);
    }

    /**
     * @param model values for the template; the renderer adds {@code css} and {@code pageSize}
     */
    public String render(DocumentTemplate template, Map<String, Object> model, PageSize pageSize) {
        return render(template, model, pageSize, "");
    }

    /**
     * @param overrides extra CSS appended after the template's stylesheet. Must be built by our code from
     *                  validated values (numbers), never from user text.
     */
    public String render(DocumentTemplate template, Map<String, Object> model, PageSize pageSize, String overrides) {
        Map<String, Object> variables = new HashMap<>(model);
        variables.put("css", stylesheet(BASE_STYLESHEET).replace("__PAGE_SIZE__", pageSize.css())
                + "\n" + stylesheet(template.stylesheet()) + (overrides.isEmpty() ? "" : "\n" + overrides));
        variables.put("pageSize", pageSize.css());
        return engine.process(template.view(), new Context(Locale.ENGLISH, variables));
    }

    private String stylesheet(String name) {
        return stylesheets.computeIfAbsent(name, key -> {
            ClassPathResource css = new ClassPathResource("documents/css/" + key + ".css");
            try (InputStream in = css.getInputStream()) {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new IllegalStateException("Missing document stylesheet " + key, e);
            }
        });
    }
}
