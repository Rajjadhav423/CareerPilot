package com.careerpilot.backend.resume;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
public class ResumeControllerIntegrationTest {

    private static final JwtRequestPostProcessor RAJ = jwt().jwt(t -> t.subject("user_raj"));
    private static final JwtRequestPostProcessor FRIEND = jwt().jwt(t -> t.subject("user_friend"));

    public static final String DATA = """
            {"schemaVersion": 2,
             "basics": {"fullName": "Raj Jadhav", "headline": "Backend Engineer", "email": "raj@example.com",
                        "links": [{"label": "GitHub", "url": "github.com/raj"}]},
             "sections": [
               {"id": "summary", "type": "text", "title": "Summary", "content": "Builds reliable <b>APIs</b>."},
               {"id": "exp", "type": "entries", "title": "Experience", "entries": [
                 {"id": "cred", "title": "Software Engineer", "subtitle": "CRED", "startDate": "2022", "current": true,
                  "bullets": ["Built payments"]}]},
               {"id": "skills", "type": "skills", "title": "Skills", "groups": [{"name": "Backend", "keywords": ["Java", "Spring Boot"]}]}
             ],
             "unknownField": "ignored"}
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
    void createListUpdateAndDelete() throws Exception {
        String id = idOf(create(RAJ, "My resume", "modern")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/v1/resumes/")))
                .andExpect(jsonPath("$.templateId").value("modern"))
                .andExpect(jsonPath("$.pageSize").value("A4"))
                .andExpect(jsonPath("$.data.schemaVersion").value(2))
                .andExpect(jsonPath("$.data.sections[1].title").value("Experience"))
                .andExpect(jsonPath("$.data.sections[2].groups[0].id").exists())
                .andExpect(jsonPath("$.data.unknownField").doesNotExist()));

        mockMvc.perform(get("/api/v1/resumes").with(RAJ))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].fullName").value("Raj Jadhav"))
                .andExpect(jsonPath("$[0].pendingProposals").value(0))
                .andExpect(jsonPath("$[0].data").doesNotExist());

        mockMvc.perform(put("/api/v1/resumes/" + id).with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content(request("Renamed", "classic", "LETTER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Renamed"))
                .andExpect(jsonPath("$.pageSize").value("LETTER"));

        mockMvc.perform(delete("/api/v1/resumes/" + id).with(RAJ)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/resumes/" + id).with(RAJ)).andExpect(status().isNotFound());
    }

    @Test
    void resumesSavedInTheOriginalFormatOpenInTheNewOne() throws Exception {
        String id = idOf(create(RAJ, "Old", "classic"));
        jdbc.update("update resumes set data = ?::jsonb where id = ?::uuid", """
                {"basics": {"fullName": "Raj"}, "summary": "Old summary",
                 "experience": [{"title": "Dev", "organization": "CRED", "highlights": ["Did it"]}]}
                """, id);

        mockMvc.perform(get("/api/v1/resumes/" + id).with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sections[0].type").value("text"))
                .andExpect(jsonPath("$.data.sections[0].content").value("Old summary"))
                .andExpect(jsonPath("$.data.sections[1].entries[0].subtitle").value("CRED"));
    }

    @Test
    void otherUsersResumesAndVersionsAreInvisible() throws Exception {
        String id = idOf(create(RAJ, "Raj's resume", "classic"));
        String versionId = JsonPath.read(mockMvc.perform(get("/api/v1/resumes/" + id + "/versions").with(RAJ))
                .andReturn().getResponse().getContentAsString(), "$[0].id");

        mockMvc.perform(get("/api/v1/resumes/" + id).with(FRIEND))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESUME_NOT_FOUND"));
        mockMvc.perform(put("/api/v1/resumes/" + id).with(FRIEND).contentType(MediaType.APPLICATION_JSON)
                .content(request("Hijack", "classic", "A4"))).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/resumes/" + id).with(FRIEND)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/resumes/" + id + "/versions").with(FRIEND)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/resumes/" + id + "/versions/" + versionId).with(FRIEND)).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/resumes/" + id + "/versions").with(FRIEND).contentType(MediaType.APPLICATION_JSON)
                .content("{\"data\": " + DATA + "}")).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/resumes/" + id + "/versions/" + versionId + "/accept").with(FRIEND))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/resumes").with(FRIEND)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void everySaveIsKeptAsHistoryAndCanBeRestored() throws Exception {
        String id = idOf(create(RAJ, "V1", "classic"));
        mockMvc.perform(put("/api/v1/resumes/" + id).with(RAJ).contentType(MediaType.APPLICATION_JSON)
                .content(request("V2", "modern", "A4").replace("Backend Engineer", "Platform Engineer")));

        String body = mockMvc.perform(get("/api/v1/resumes/" + id + "/versions").with(RAJ))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].number").value(2))
                .andExpect(jsonPath("$[1].label").value("Created"))
                .andReturn().getResponse().getContentAsString();
        String first = JsonPath.read(body, "$[1].id");

        mockMvc.perform(post("/api/v1/resumes/" + id + "/versions/" + first + "/accept").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templateId").value("classic"))
                .andExpect(jsonPath("$.data.basics.headline").value("Backend Engineer"));
        mockMvc.perform(get("/api/v1/resumes/" + id + "/versions").with(RAJ))
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].source").value("RESTORE"))
                .andExpect(jsonPath("$[0].label").value("Restored version 1"));
        mockMvc.perform(delete("/api/v1/resumes/" + id + "/versions/" + first).with(RAJ))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NOT_A_PROPOSAL"));
    }

    @Test
    void proposalsAreReviewedAsADiffBeforeTheyChangeTheResume() throws Exception {
        String id = idOf(create(RAJ, "Main", "classic"));
        String proposed = DATA.replace("\"Experience\"", "\"Work Experience\"").replace("Built payments", "Built **payments** at scale");

        String versionId = JsonPath.read(mockMvc.perform(post("/api/v1/resumes/" + id + "/versions").with(RAJ)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\": \"Tailored for Stripe\", \"source\": \"AI\", \"data\": " + proposed + "}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PROPOSED"))
                .andExpect(jsonPath("$.source").value("AI"))
                .andReturn().getResponse().getContentAsString(), "$.id");

        // The resume itself is unchanged until accepted
        mockMvc.perform(get("/api/v1/resumes/" + id).with(RAJ)).andExpect(jsonPath("$.data.sections[1].title").value("Experience"));
        mockMvc.perform(get("/api/v1/resumes").with(RAJ)).andExpect(jsonPath("$[0].pendingProposals").value(1));
        mockMvc.perform(get("/api/v1/resumes/" + id + "/versions").with(RAJ))
                .andExpect(jsonPath("$[0].changes").value(greaterThan(0)));

        mockMvc.perform(get("/api/v1/resumes/" + id + "/versions/" + versionId + "/diff").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.changes[?(@.field == 'title')].after").value(hasItem("Work Experience")))
                .andExpect(jsonPath("$.changes[?(@.field == 'bullets')].after").value(hasItem("Built payments at scale")));

        mockMvc.perform(post("/api/v1/resumes/" + id + "/versions/" + versionId + "/accept").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sections[1].title").value("Work Experience"));
        mockMvc.perform(get("/api/v1/resumes/" + id + "/versions").with(RAJ))
                .andExpect(jsonPath("$[0].status").value("ACCEPTED"));

        String another = JsonPath.read(mockMvc.perform(post("/api/v1/resumes/" + id + "/versions").with(RAJ)
                .contentType(MediaType.APPLICATION_JSON).content("{\"data\": " + DATA + "}"))
                .andExpect(jsonPath("$.label").value("Imported JSON"))
                .andReturn().getResponse().getContentAsString(), "$.id");
        mockMvc.perform(delete("/api/v1/resumes/" + id + "/versions/" + another).with(RAJ)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/resumes/" + id + "/versions/" + another).with(RAJ)).andExpect(status().isNotFound());
    }

    @Test
    void schemaAndNormalizeHelpPeopleAndAssistantsWriteValidJson() throws Exception {
        mockMvc.perform(get("/api/v1/resumes/schema").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/schema+json"))
                .andExpect(jsonPath("$.properties.sections.maxItems").value(25))
                .andExpect(jsonPath("$.$defs.section.properties.type.enum[0]").value("entries"));

        mockMvc.perform(post("/api/v1/resumes/normalize").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basics\": {\"fullName\": \"Raj\"}, \"skills\": [{\"name\": \"Backend\", \"items\": [\"Java\"]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schemaVersion").value(2))
                .andExpect(jsonPath("$.sections[0].type").value("skills"))
                .andExpect(jsonPath("$.sections[0].groups[0].id").exists());

        mockMvc.perform(post("/api/v1/resumes/normalize").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basics\": {\"fullName\": \"\"}, \"sections\": [{\"type\": \"text\", \"title\": \"\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['data.basics.fullName']").exists())
                .andExpect(jsonPath("$.errors['data.sections[0].title']").exists());

        mockMvc.perform(post("/api/v1/resumes/normalize").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"basics\": {\"fullName\": \"Raj\"}, \"sections\": [{\"type\": \"poem\", \"title\": \"x\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RESUME_JSON"));
    }

    @Test
    void invalidResumeJsonIsRejectedWithFieldErrors() throws Exception {
        mockMvc.perform(post("/api/v1/resumes/render/pdf").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"data": {"basics": {"fullName": "", "email": "nope", "links": [{"url": "javascript:alert(1)"}]},
                                          "sections": [{"type": "entries", "title": "X", "entries": [{"title": ""}]}]}}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors['data.basics.fullName']").exists())
                .andExpect(jsonPath("$.errors['data.basics.email']").exists())
                .andExpect(jsonPath("$.errors['data.basics.links[0].url']").exists())
                .andExpect(jsonPath("$.errors['data.sections[0].entries[0].title']").exists());

        mockMvc.perform(post("/api/v1/resumes/render/pdf").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                .content("{\"data\": {\"basics\": ")).andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/resumes/render/preview").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\": \"../evil\", \"data\": " + DATA + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNKNOWN_TEMPLATE"));
    }

    @Test
    void previewIsEscapedHtmlThatCannotRunScripts() throws Exception {
        mockMvc.perform(post("/api/v1/resumes/render/preview").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\": \"classic\", \"data\": " + DATA + "}"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().string(containsString("Builds reliable &lt;b&gt;APIs&lt;/b&gt;.")))
                .andExpect(content().string(not(containsString("<b>APIs"))));
    }

    @Test
    void pdfDownloadsAsAnAttachment() throws Exception {
        byte[] pdf = mockMvc.perform(post("/api/v1/resumes/render/pdf").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\": \"modern\", \"fileName\": \"../../etc/passwd\", \"data\": " + DATA + "}"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("Content-Disposition", not(containsString("/"))))
                .andExpect(header().string("X-Document-Pages", "1"))
                .andReturn().getResponse().getContentAsByteArray();

        org.assertj.core.api.Assertions.assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    void hugeRequestsAreRefusedBeforeParsing() throws Exception {
        String huge = "{\"data\": {\"basics\": {\"fullName\": \"" + "x".repeat(600_000) + "\"}}}";

        mockMvc.perform(post("/api/v1/resumes/render/pdf").with(RAJ).contentType(MediaType.APPLICATION_JSON).content(huge))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.code").value("REQUEST_TOO_LARGE"));
    }

    @Test
    void templatesAreListedAndEverythingNeedsSignIn() throws Exception {
        mockMvc.perform(get("/api/v1/resumes/templates").with(RAJ))
                .andExpect(jsonPath("$[0].id").value("classic"))
                .andExpect(jsonPath("$[1].id").value("modern"));
        mockMvc.perform(get("/api/v1/resumes")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/resumes/schema")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/resumes/render/pdf").contentType(MediaType.APPLICATION_JSON)
                .content("{\"data\": " + DATA + "}")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/resumes/" + UUID.randomUUID() + "/versions")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/drive/documents")).andExpect(status().isUnauthorized());
    }

    private ResultActions create(JwtRequestPostProcessor user, String title, String template) throws Exception {
        return mockMvc.perform(post("/api/v1/resumes").with(user).contentType(MediaType.APPLICATION_JSON)
                .content(request(title, template, null)));
    }

    private static String request(String title, String template, String pageSize) {
        return "{\"title\": \"" + title + "\", \"templateId\": \"" + template + "\""
                + (pageSize == null ? "" : ", \"pageSize\": \"" + pageSize + "\"") + ", \"data\": " + DATA + "}";
    }

    private static String idOf(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }
}
