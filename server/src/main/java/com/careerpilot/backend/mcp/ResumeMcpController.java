package com.careerpilot.backend.mcp;

import java.util.Set;
import java.util.UUID;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.careerpilot.backend.document.PageSize;
import com.careerpilot.backend.resume.ResumeData;
import com.careerpilot.backend.resume.ResumeDocumentService;
import com.careerpilot.backend.resume.ResumeDtos.ResumeRequest;
import com.careerpilot.backend.resume.ResumeJson;
import com.careerpilot.backend.resume.ResumeService;
import com.careerpilot.backend.resume.ResumeTemplates;
import com.careerpilot.backend.user.CurrentUserService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Minimal authenticated MCP Streamable HTTP endpoint for CareerPilot resume workflows.
 * Every tool resolves the current user from the verified Clerk JWT.
 */
@RestController
@RequestMapping("/mcp")
public class ResumeMcpController {
    private static final String PROTOCOL_VERSION = "2025-03-26";

    private final ResumeService resumes;
    private final ResumeDocumentService documents;
    private final ResumeTemplates templates;
    private final CurrentUserService currentUsers;
    private final ResumeJson resumeJson;
    private final Validator validator;
    private final ObjectMapper mapper;

    public ResumeMcpController(ResumeService resumes, ResumeDocumentService documents, ResumeTemplates templates,
            CurrentUserService currentUsers, ResumeJson resumeJson, Validator validator, ObjectMapper mapper) {
        this.resumes = resumes;
        this.documents = documents;
        this.templates = templates;
        this.currentUsers = currentUsers;
        this.resumeJson = resumeJson;
        this.validator = validator;
        this.mapper = mapper;
    }

    @PostMapping
    public ResponseEntity<JsonNode> handle(@AuthenticationPrincipal Jwt jwt, @RequestBody JsonNode request) {
        String method = request.path("method").asString("");
        JsonNode id = request.path("id");
        if (method.startsWith("notifications/")) {
            return ResponseEntity.accepted().build();
        }

        JsonNode result = null;
        JsonNode rpcError = null;
        try {
            JsonNode params = request.path("params");
            switch (method) {
                case "initialize" -> result = initialize();
                case "ping" -> result = mapper.createObjectNode();
                case "tools/list" -> result = toolsList();
                case "tools/call" -> result = callTool(jwt, params);
                default -> rpcError = error(-32601, "Method not found");
            }
        } catch (IllegalArgumentException ex) {
            rpcError = error(-32602, ex.getMessage() == null ? "Invalid tool arguments" : ex.getMessage());
        } catch (Exception ex) {
            rpcError = error(-32603, "The requested CareerPilot operation failed");
        }

        var response = mapper.createObjectNode();
        response.put("jsonrpc", "2.0");
        if (!id.isMissingNode() && !id.isNull()) {
            response.set("id", id);
        }
        if (rpcError != null) {
            response.set("error", rpcError);
        } else {
            response.set("result", result);
        }
        return ResponseEntity.ok(response);
    }

    private JsonNode initialize() {
        var result = mapper.createObjectNode();
        result.put("protocolVersion", PROTOCOL_VERSION);
        result.set("capabilities", mapper.createObjectNode().set("tools", mapper.createObjectNode()));
        var info = mapper.createObjectNode();
        info.put("name", "careerpilot");
        info.put("title", "CareerPilot");
        info.put("version", "1.0.0");
        result.set("serverInfo", info);
        result.put("instructions", "CareerPilot helps manage personal job-search resumes. Review generated content before using it.");
        return result;
    }

    private JsonNode toolsList() {
        var result = mapper.createObjectNode();
        var tools = mapper.createArrayNode();
        tools.add(tool("get_resume_schema", "Get the JSON schema used by CareerPilot resumes.", mapper.createObjectNode()));
        tools.add(tool("get_resume_templates", "List available resume templates.", mapper.createObjectNode()));
        tools.add(tool("list_my_resumes", "List resumes belonging to the signed-in user.", mapper.createObjectNode()));
        var createSchema = mapper.createObjectNode();
        createSchema.put("type", "object");
        createSchema.set("properties", mapper.createObjectNode()
                .set("title", mapper.createObjectNode().put("type", "string").put("maxLength", 120)));
        ((tools.jackson.databind.node.ObjectNode) createSchema.get("properties"))
                .set("templateId", mapper.createObjectNode().put("type", "string").put("maxLength", 40));
        ((com.fasterxml.jackson.databind.node.ObjectNode) createSchema.get("properties"))
                .set("data", mapper.createObjectNode().put("type", "object").put("description", "Resume data matching get_resume_schema."));
        createSchema.set("required", mapper.createArrayNode().add("title").add("data"));
        createSchema.put("additionalProperties", false);
        tools.add(tool("create_resume_draft", "Create a resume draft in your CareerPilot account.", createSchema));
        var previewSchema = mapper.createObjectNode();
        previewSchema.put("type", "object");
        previewSchema.set("properties", mapper.createObjectNode()
                .set("templateId", mapper.createObjectNode().put("type", "string"))
                .set("data", mapper.createObjectNode().put("type", "object").put("description", "Resume data matching get_resume_schema.")));
        previewSchema.set("required", mapper.createArrayNode().add("data"));
        previewSchema.put("additionalProperties", false);
        tools.add(tool("preview_resume", "Render resume HTML for review without saving it.", previewSchema));
        result.set("tools", tools);
        return result;
    }

    private JsonNode tool(String name, String description, JsonNode schema) {
        var tool = mapper.createObjectNode();
        tool.put("name", name);
        tool.put("description", description);
        tool.set("inputSchema", schema);
        return tool;
    }

    private JsonNode callTool(Jwt jwt, JsonNode params) throws Exception {
        String name = params.path("name").asString("");
        JsonNode args = params.path("arguments");
        UUID userId = currentUsers.resolve(jwt).getId();
        JsonNode output = switch (name) {
            case "get_resume_schema" -> mapper.readTree(getSchema());
            case "get_resume_templates" -> mapper.valueToTree(templates.all());
            case "list_my_resumes" -> mapper.valueToTree(resumes.list(userId));
            case "create_resume_draft" -> createDraft(userId, args);
            case "preview_resume" -> preview(args);
            default -> throw new IllegalArgumentException("Unknown tool: " + name);
        };
        var result = mapper.createObjectNode();
        result.set("content", mapper.createArrayNode().add(mapper.createObjectNode()
                .put("type", "text").put("text", mapper.writeValueAsString(output))));
        result.set("structuredContent", output);
        result.put("isError", false);
        return result;
    }

    private JsonNode createDraft(UUID userId, JsonNode args) {
        String title = args.path("title").asString("").strip();
        if (title.isBlank() || title.length() > 120 || !args.hasNonNull("data")) {
            throw new IllegalArgumentException("Provide a title (up to 120 characters) and resume data.");
        }
        ResumeData data = resumeJson.read(args.path("data"));
        Set<ConstraintViolation<ResumeData>> violations = validator.validate(data);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException("Resume data failed validation: "
                    + violations.stream().limit(8).map(v -> v.getPropertyPath() + " " + v.getMessage()).toList());
        }
        String templateId = args.path("templateId").isMissingNode() ? null : args.path("templateId").asString();
        return mapper.valueToTree(resumes.create(userId, new ResumeRequest(title, templateId, PageSize.A4, data)));
    }

    private JsonNode preview(JsonNode args) {
        if (!args.hasNonNull("data")) {
            throw new IllegalArgumentException("Resume data is required.");
        }
        ResumeData data = resumeJson.read(args.path("data"));
        Set<ConstraintViolation<ResumeData>> violations = validator.validate(data);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException("Resume data failed validation: "
                    + violations.stream().limit(8).map(v -> v.getPropertyPath() + " " + v.getMessage()).toList());
        }
        String templateId = args.path("templateId").isMissingNode() ? null : args.path("templateId").asString();
        var result = mapper.createObjectNode();
        result.put("html", documents.renderHtml(templateId, PageSize.A4, data));
        result.put("note", "Preview only; this operation does not save a resume.");
        return result;
    }

    private String getSchema() throws Exception {
        try (var input = new org.springframework.core.io.ClassPathResource("documents/schema/resume.schema.json").getInputStream()) {
            return new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }
    }

    private JsonNode error(int code, String message) {
        var error = mapper.createObjectNode();
        error.put("code", code);
        error.put("message", message);
        return error;
    }
}
