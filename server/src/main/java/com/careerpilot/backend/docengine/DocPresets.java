package com.careerpilot.backend.docengine;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Ready-made style sets a document can start from ({@code "preset": "classic"}). Each is a JSON file in
 * {@code docengine/presets/} with {@code id}, {@code name}, {@code description} and {@code styles}; the styles
 * follow exactly the same rules as a document's own and are validated at startup. To add one: create the file
 * and list its id in {@link #IDS}.
 */
@Component
public class DocPresets {

    private static final List<String> IDS = List.of("classic", "modern");

    public record Preset(String id, String name, String description, Map<String, Map<String, String>> styles) {
    }

    private final Map<String, Preset> presets = new LinkedHashMap<>();

    public DocPresets(JsonMapper json) {
        for (String id : IDS) {
            presets.put(id, load(json, id));
        }
    }

    private static Preset load(JsonMapper json, String id) {
        JsonNode file;
        try (InputStream in = new ClassPathResource("docengine/presets/" + id + ".json").getInputStream()) {
            file = json.readTree(in);
        } catch (IOException e) {
            throw new IllegalStateException("Missing document preset " + id, e);
        }
        // Validate the styles with the document rules: a minimal document that uses them
        ObjectNode probe = JsonNodeFactory.instance.objectNode();
        probe.put("schemaVersion", 3);
        probe.put("document", "resume");
        probe.set("styles", file.get("styles"));
        probe.putArray("sections").addObject().put("id", "probe").putArray("nodes");
        DocReader.Result result = DocReader.read(probe, DocReader.Mode.STRICT, Map.of());
        if (!result.valid()) {
            throw new IllegalStateException("Preset " + id + " breaks the document rules: " + result.errors());
        }
        return new Preset(id, file.path("name").asString(id), file.path("description").asString(""),
                result.doc().styles());
    }

    public List<Preset> all() {
        return List.copyOf(presets.values());
    }

    public Optional<Preset> find(String id) {
        return Optional.ofNullable(id == null ? null : presets.get(id));
    }

    /** Preset id → styles, for {@link DocReader}. */
    Map<String, Map<String, Map<String, String>>> stylesById() {
        Map<String, Map<String, Map<String, String>>> styles = new LinkedHashMap<>();
        presets.forEach((id, preset) -> styles.put(id, preset.styles()));
        return styles;
    }
}
