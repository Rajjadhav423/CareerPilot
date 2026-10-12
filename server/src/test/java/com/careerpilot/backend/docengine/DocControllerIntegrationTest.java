package com.careerpilot.backend.docengine;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class DocControllerIntegrationTest {

    private static final JwtRequestPostProcessor RAJ = jwt().jwt(t -> t.subject("user_raj"));

    private static final String DOC = """
            {"schemaVersion": 3, "document": "resume", "preset": "modern",
             "meta": {"title": "Raj Jadhav — Resume", "author": "Raj Jadhav"},
             "page": {"maxPages": 1},
             "sections": [{"id": "header", "nodes": [
               {"tag": "h1", "class": "name", "text": "Raj Jadhav"},
               {"tag": "p", "html": "Backend engineer · <a href=\\"https://github.com/raj\\">github.com/raj</a>"}
             ]}]}
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        jdbc.execute("truncate table users cascade");
    }

    @Test
    void rulesAndPresetsAreServedForPeopleAndAssistants() throws Exception {
        mockMvc.perform(get("/api/v1/docs/rules").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/markdown"))
                .andExpect(content().string(containsString("docEngine — document JSON rules")));

        mockMvc.perform(get("/api/v1/docs/presets").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem("classic")))
                .andExpect(jsonPath("$[0].styles['.section-title']").exists());
    }

    @Test
    void validateReportsErrorsWithPathsAndPagesWhenValid() throws Exception {
        mockMvc.perform(post("/api/v1/docs/validate").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document\": " + DOC + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.pages").value(1))
                .andExpect(jsonPath("$.document").doesNotExist());

        String broken = DOC.replace("\"tag\": \"h1\"", "\"tag\": \"script\"").replace("\"maxPages\": 1", "\"maxPages\": 1, \"columns\": 2");
        mockMvc.perform(post("/api/v1/docs/validate").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document\": " + broken + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.errors[?(@.path == '/sections/0/nodes/0/tag')].code").value(hasItem("TAG_BLOCKED")))
                .andExpect(jsonPath("$.errors[?(@.path == '/page/columns')].code").value(hasItem("UNKNOWN_FIELD")))
                .andExpect(jsonPath("$.pages").isEmpty());

        mockMvc.perform(post("/api/v1/docs/validate").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\": \"lenient\", \"document\": " + broken + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.warnings[*].code", hasItem("TAG_BLOCKED")))
                .andExpect(jsonPath("$.document.schemaVersion").value(3));
    }

    @Test
    void renderReturnsAPdfPageImagesOrHtml() throws Exception {
        mockMvc.perform(post("/api/v1/docs/render/pdf").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileName\": \"../evil\", \"document\": " + DOC + "}"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("X-Document-Pages", "1"));

        mockMvc.perform(post("/api/v1/docs/render/pages").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document\": " + DOC + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pageCount").value(1))
                .andExpect(jsonPath("$.pages[0]").value(startsWith("iVBORw0KGgo")));

        mockMvc.perform(post("/api/v1/docs/render/html").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document\": " + DOC + "}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")))
                .andExpect(content().string(containsString("<a href=\"https://github.com/raj\" title=\"github.com/raj\">github.com/raj</a>")));
    }

    @Test
    void invalidDocumentsAreRejectedWithEveryIssue() throws Exception {
        String invalid = DOC.replace("\"class\": \"name\"", "\"style\": {\"display\": \"grid\"}");
        mockMvc.perform(post("/api/v1/docs/render/pdf").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"document\": " + invalid + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DOCUMENT_INVALID"))
                .andExpect(jsonPath("$.issues[0].path").value("/sections/0/nodes/0/style/display"))
                .andExpect(jsonPath("$.issues[0].code").value("CSS_LAYOUT_UNSUPPORTED"));

        mockMvc.perform(post("/api/v1/docs/render/pdf").with(RAJ).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DOCUMENT_MISSING"));

        mockMvc.perform(post("/api/v1/docs/validate").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\": \"yolo\", \"document\": " + DOC + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MODE_INVALID"));
    }

    @Test
    void everythingNeedsSignIn() throws Exception {
        mockMvc.perform(get("/api/v1/docs/rules")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/docs/render/pdf").contentType(MediaType.APPLICATION_JSON).content("{\"document\": " + DOC + "}"))
                .andExpect(status().isUnauthorized());
    }
}
