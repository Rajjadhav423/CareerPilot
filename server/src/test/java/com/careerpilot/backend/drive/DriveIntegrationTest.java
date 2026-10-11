package com.careerpilot.backend.drive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.careerpilot.backend.drive.GoogleDriveClient.DriveApiException;
import com.careerpilot.backend.drive.GoogleDriveClient.DriveFile;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccessToken;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccount;
import com.careerpilot.backend.resume.ResumeControllerIntegrationTest;

/**
 * Google Drive end to end with the Google token coming from Clerk (as for Gmail). Clerk's Backend API and
 * Google Drive are mocked: no real Google account. Database, security and controllers are real.
 */
@SpringBootTest
@AutoConfigureMockMvc
class DriveIntegrationTest {

    private static final JwtRequestPostProcessor RAJ = jwt().jwt(t -> t.subject("user_raj"));
    private static final JwtRequestPostProcessor FRIEND = jwt().jwt(t -> t.subject("user_friend"));
    private static final String DRIVE = ClerkGoogleAccounts.DRIVE_FILE_SCOPE;
    private static final String GMAIL = ClerkGoogleAccounts.GMAIL_SEND_SCOPE;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoBean
    private ClerkGoogleAccounts google;

    @MockitoBean
    private GoogleDriveClient drive;

    @BeforeEach
    void cleanDatabase() {
        jdbc.execute("truncate table users cascade");
        given(google.isConfigured()).willReturn(true);
    }

    @Test
    void statusFollowsTheClerkPermissionAndNeverExposesTokens() throws Exception {
        grant("user_raj", "raj@gmail.com", GMAIL);

        mockMvc.perform(get("/api/v1/drive/status").with(RAJ))
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.permissionGranted").value(false))
                .andExpect(jsonPath("$.connected").value(false));
        mockMvc.perform(post("/api/v1/drive/connect").with(RAJ))
                .andExpect(jsonPath("$.needsGoogleConsent").value(true))
                .andExpect(jsonPath("$.scope").value(DRIVE));

        grant("user_raj", "raj@gmail.com", GMAIL, DRIVE);
        mockMvc.perform(get("/api/v1/drive/status").with(RAJ))
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.googleEmail").value("raj@gmail.com"))
                .andExpect(content().string(not(containsString("ya29"))));
        mockMvc.perform(post("/api/v1/drive/connect").with(RAJ))
                .andExpect(jsonPath("$.needsGoogleConsent").value(false));
    }

    @Test
    void noGoogleTokensAreStoredByCareerPilot() throws Exception {
        connectWithOneDocument(RAJ, "user_raj");

        Integer tokenTables = jdbc.queryForObject(
                "select count(*) from information_schema.tables where table_name in ('drive_connections', 'drive_oauth_states')",
                Integer.class);
        assertThat(tokenTables).isZero();
        Integer tokenColumns = jdbc.queryForObject(
                "select count(*) from information_schema.columns where table_name = 'drive_settings' and column_name like '%token%'",
                Integer.class);
        assertThat(tokenColumns).isZero();
    }

    @Test
    void withoutTheClerkSecretKeyDriveIsUnavailable() throws Exception {
        given(google.isConfigured()).willReturn(false);

        mockMvc.perform(get("/api/v1/drive/status").with(RAJ)).andExpect(jsonPath("$.configured").value(false));
        mockMvc.perform(post("/api/v1/drive/connect").with(RAJ))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DRIVE_NOT_CONFIGURED"));
        mockMvc.perform(get("/api/v1/drive/documents").with(RAJ)).andExpect(status().isServiceUnavailable());
    }

    @Test
    void aTokenWithoutTheDrivePermissionIsRefused() throws Exception {
        grant("user_raj", "raj@gmail.com", GMAIL);

        mockMvc.perform(get("/api/v1/drive/documents").with(RAJ))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DRIVE_PERMISSION_MISSING"));
        verify(drive, never()).list(anyString(), anyString(), anyInt());
    }

    @Test
    void savingAResumeIsIdempotentAndAvoidsDuplicateNames() throws Exception {
        grant("user_raj", "raj@gmail.com", GMAIL, DRIVE);
        given(drive.list(anyString(), argThat(q -> q != null && q.contains("careerpilotRequest")), anyInt())).willReturn(List.of());
        given(drive.createFolder(anyString(), eq("CareerPilot"), any())).willReturn(folder("folder-1", "CareerPilot"));
        given(drive.list(anyString(), argThat(q -> q != null && q.contains("in parents")), anyInt()))
                .willReturn(List.of(pdf("existing", "Raj Jadhav - Resume.pdf", "folder-1")));
        given(drive.upload(anyString(), anyString(), eq("folder-1"), eq("application/pdf"), any(), any()))
                .willAnswer(call -> pdf("file-1", call.getArgument(1), "folder-1"));

        String requestId = UUID.randomUUID().toString();
        String first = JsonPath.read(saveToDrive(RAJ, requestId)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Raj Jadhav - Resume (2).pdf"))
                .andReturn().getResponse().getContentAsString(), "$.id");
        saveToDrive(RAJ, requestId).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(first));

        ArgumentCaptor<byte[]> content = ArgumentCaptor.forClass(byte[].class);
        verify(drive, times(1)).upload(eq("ya29.user_raj"), anyString(), eq("folder-1"), eq("application/pdf"),
                argThat(props -> props != null && "document".equals(props.get("careerpilot"))
                        && requestId.equals(props.get("careerpilotRequest"))),
                content.capture());
        assertThat(new String(content.getValue(), 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        mockMvc.perform(get("/api/v1/drive/status").with(RAJ)).andExpect(jsonPath("$.folderName").value("CareerPilot"));
    }

    @Test
    void anUploadThatReachedDriveBeforeAFailureIsRecoveredNotDuplicated() throws Exception {
        grant("user_raj", "raj@gmail.com", DRIVE);
        String requestId = UUID.randomUUID().toString();
        given(drive.list(anyString(), argThat(q -> q != null && q.contains(requestId)), anyInt()))
                .willReturn(List.of(pdf("file-earlier", "Raj Jadhav - Resume.pdf", "folder-1")));

        saveToDrive(RAJ, requestId).andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Raj Jadhav - Resume.pdf"));

        verify(drive, never()).upload(anyString(), anyString(), any(), anyString(), any(), any());
    }

    @Test
    void listingFollowsDriveAndRenameRejectsDuplicates() throws Exception {
        grant("user_raj", "raj@gmail.com", DRIVE);
        given(drive.list(anyString(), argThat(q -> q != null && q.contains("value='document'")), anyInt()))
                .willReturn(List.of(pdf("a", "Alpha.pdf", "f"), pdf("b", "Beta.pdf", "f")));

        String body = mockMvc.perform(get("/api/v1/drive/documents").with(RAJ))
                .andExpect(jsonPath("$", hasSize(2))).andReturn().getResponse().getContentAsString();
        String alphaId = JsonPath.read(body, "$[?(@.name == 'Alpha.pdf')].id").toString().replaceAll("[\\[\\]\"]", "");

        mockMvc.perform(patch("/api/v1/drive/documents/" + alphaId).with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"beta\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DRIVE_NAME_TAKEN"));

        given(drive.update(anyString(), eq("a"), eq(Map.of("name", "Gamma.pdf")))).willReturn(pdf("a", "Gamma.pdf", "f"));
        mockMvc.perform(patch("/api/v1/drive/documents/" + alphaId).with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Gamma\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Gamma.pdf"));

        given(drive.list(anyString(), argThat(q -> q != null && q.contains("value='document'")), anyInt()))
                .willReturn(List.of(pdf("a", "Gamma.pdf", "f")));
        mockMvc.perform(get("/api/v1/drive/documents").with(RAJ))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Gamma.pdf"));
    }

    @Test
    void deletingNeedsConfirmationAndOnlyTrashesTheFile() throws Exception {
        String id = connectWithOneDocument(RAJ, "user_raj");

        mockMvc.perform(delete("/api/v1/drive/documents/" + id).with(RAJ))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CONFIRMATION_REQUIRED"));
        verify(drive, never()).update(anyString(), anyString(), any());

        given(drive.update(anyString(), eq("a"), eq(Map.of("trashed", true)))).willReturn(pdf("a", "Alpha.pdf", "f"));
        mockMvc.perform(delete("/api/v1/drive/documents/" + id).param("confirm", "true").with(RAJ))
                .andExpect(status().isNoContent());
        verify(drive).update(anyString(), eq("a"), eq(Map.of("trashed", true)));
        assertThat(jdbc.queryForObject("select count(*) from drive_documents", Integer.class)).isZero();
    }

    @Test
    void usersCannotSeeOrChangeEachOthersDocuments() throws Exception {
        String rajsDocument = connectWithOneDocument(RAJ, "user_raj");
        grant("user_friend", "friend@gmail.com", DRIVE);

        mockMvc.perform(patch("/api/v1/drive/documents/" + rajsDocument).with(FRIEND).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"stolen\"}")).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/drive/documents/" + rajsDocument).param("confirm", "true").with(FRIEND))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/drive/documents/" + rajsDocument + "/download").with(FRIEND))
                .andExpect(status().isNotFound());
        verify(drive, never()).update(eq("ya29.user_friend"), anyString(), any());
        verify(drive, never()).download(eq("ya29.user_friend"), anyString(), any(Long.class));
    }

    @Test
    void downloadingChecksTheFileIsACareerPilotDocument() throws Exception {
        String id = connectWithOneDocument(RAJ, "user_raj");
        given(drive.get(anyString(), eq("a"))).willReturn(pdf("a", "Alpha.pdf", "f"));
        given(drive.download(anyString(), eq("a"), any(Long.class))).willReturn("%PDF-1.7".getBytes(StandardCharsets.US_ASCII));

        mockMvc.perform(get("/api/v1/drive/documents/" + id + "/download").with(RAJ))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", containsString("Alpha.pdf")));

        given(drive.get(anyString(), eq("a"))).willReturn(new DriveFile("a", "Alpha.pdf", "application/pdf", "10",
                null, List.of("f"), Map.of(), false, null, null));
        mockMvc.perform(get("/api/v1/drive/documents/" + id + "/download").with(RAJ)).andExpect(status().isNotFound());
    }

    @Test
    void revokedAccessAsksTheUserToReconnectAfterOneRetry() throws Exception {
        grant("user_raj", "raj@gmail.com", DRIVE);
        given(drive.list(anyString(), anyString(), anyInt())).willThrow(new DriveApiException(401, null));

        mockMvc.perform(get("/api/v1/drive/documents").with(RAJ))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DRIVE_RECONNECT_REQUIRED"));
        // The token was fetched from Clerk again (Clerk refreshes) before giving up
        verify(google, atLeast(2)).findAccessToken("user_raj");
    }

    @Test
    void googleOutagesAreReportedSafely() throws Exception {
        grant("user_raj", "raj@gmail.com", DRIVE);
        given(drive.list(anyString(), anyString(), anyInt())).willThrow(new DriveApiException(503, "backendError"));

        mockMvc.perform(get("/api/v1/drive/documents").with(RAJ))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("DRIVE_UNAVAILABLE"))
                .andExpect(jsonPath("$.detail").value(not(containsString("backendError"))));
    }

    @Test
    void onlyCareerPilotFoldersCanBeSelected() throws Exception {
        grant("user_raj", "raj@gmail.com", DRIVE);
        given(drive.get(anyString(), eq("someone-elses"))).willReturn(new DriveFile("someone-elses", "Taxes",
                GoogleDriveClient.FOLDER_MIME_TYPE, null, null, null, Map.of(), false, null, null));
        given(drive.get(anyString(), eq("ours"))).willReturn(folder("ours", "Applications"));

        mockMvc.perform(put("/api/v1/drive/folder").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"folderId\": \"someone-elses\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DRIVE_FOLDER_NOT_FOUND"));
        mockMvc.perform(put("/api/v1/drive/folder").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                .content("{\"folderId\": \"../../x\"}")).andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/v1/drive/folder").with(RAJ).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"folderId\": \"ours\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Applications"));
    }

    @Test
    void disconnectingSwitchesDriveOffWithoutDeletingFiles() throws Exception {
        connectWithOneDocument(RAJ, "user_raj");

        mockMvc.perform(delete("/api/v1/drive/connection").with(RAJ)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/drive/status").with(RAJ))
                .andExpect(jsonPath("$.connected").value(false))
                .andExpect(jsonPath("$.permissionGranted").value(true));
        assertThat(jdbc.queryForObject("select count(*) from drive_documents", Integer.class)).isZero();
        verify(drive, never()).update(anyString(), anyString(), any());
        mockMvc.perform(get("/api/v1/drive/documents").with(RAJ))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DRIVE_NOT_CONNECTED"));

        // Turning it back on needs no new Google consent: the permission is still on the account
        mockMvc.perform(post("/api/v1/drive/connect").with(RAJ)).andExpect(jsonPath("$.needsGoogleConsent").value(false));
        mockMvc.perform(get("/api/v1/drive/status").with(RAJ)).andExpect(jsonPath("$.connected").value(true));
    }

    @Test
    void switchingGoogleAccountsClearsTheOldDocumentList() throws Exception {
        connectWithOneDocument(RAJ, "user_raj");
        assertThat(jdbc.queryForObject("select count(*) from drive_documents", Integer.class)).isOne();

        grant("user_raj", "work@company.com", DRIVE);
        mockMvc.perform(get("/api/v1/drive/status").with(RAJ)).andExpect(jsonPath("$.googleEmail").value("work@company.com"));

        assertThat(jdbc.queryForObject("select count(*) from drive_documents", Integer.class)).isZero();
    }

    @Test
    void gmailKeepsWorkingWithTheSameGoogleConnection() throws Exception {
        grant("user_raj", "raj@gmail.com", GMAIL, DRIVE);

        mockMvc.perform(get("/api/v1/gmail/status").with(RAJ))
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.canSend").value(true));
        mockMvc.perform(get("/api/v1/drive/status").with(RAJ)).andExpect(jsonPath("$.connected").value(true));
    }

    private void grant(String clerkUserId, String email, String... scopes) {
        Set<String> granted = Set.of(scopes);
        given(google.findGoogleAccount(clerkUserId)).willReturn(Optional.of(new GoogleAccount(email, granted)));
        given(google.findAccessToken(clerkUserId)).willReturn(Optional.of(new GoogleAccessToken("ya29." + clerkUserId, granted)));
    }

    private String connectWithOneDocument(JwtRequestPostProcessor user, String clerkUserId) throws Exception {
        grant(clerkUserId, "raj@gmail.com", GMAIL, DRIVE);
        mockMvc.perform(get("/api/v1/drive/status").with(user));
        given(drive.list(anyString(), argThat(q -> q != null && q.contains("value='document'")), anyInt()))
                .willReturn(List.of(pdf("a", "Alpha.pdf", "f")));
        return JsonPath.read(mockMvc.perform(get("/api/v1/drive/documents").with(user))
                .andReturn().getResponse().getContentAsString(), "$[0].id");
    }

    private ResultActions saveToDrive(JwtRequestPostProcessor user, String requestId) throws Exception {
        return mockMvc.perform(post("/api/v1/resumes/render/drive").with(user).contentType(MediaType.APPLICATION_JSON)
                .content("{\"requestId\": \"" + requestId + "\", \"templateId\": \"classic\", \"data\": "
                        + ResumeControllerIntegrationTest.DATA + "}"));
    }

    private static DriveFile pdf(String id, String name, String folder) {
        return new DriveFile(id, name, "application/pdf", "1234", "https://drive.google.com/file/d/" + id + "/view",
                List.of(folder), Map.of("careerpilot", "document"), false, null, null);
    }

    private static DriveFile folder(String id, String name) {
        return new DriveFile(id, name, GoogleDriveClient.FOLDER_MIME_TYPE, null, null, null,
                Map.of("careerpilot", "folder"), false, null, null);
    }
}
