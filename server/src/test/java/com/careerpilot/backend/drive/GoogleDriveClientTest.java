package com.careerpilot.backend.drive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.restclient.test.autoconfigure.RestClientTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.util.UriComponentsBuilder;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.drive.GoogleDriveClient.DriveApiException;

/** Mocked Google endpoint: no real Google account or network is used. */
@RestClientTest(GoogleDriveClient.class)
class GoogleDriveClientTest {

    @Autowired
    private GoogleDriveClient drive;

    @Autowired
    private MockRestServiceServer server;

    @Test
    void uploadsAsMultipartRelatedWithMetadataAndContent() {
        server.expect(requestTo(Matchers.startsWith("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer ya29.token"))
                .andExpect(header("Content-Type", Matchers.matchesPattern("multipart/related; ?boundary=careerpilot-[0-9a-f-]{36}")))
                .andExpect(content().string(Matchers.allOf(
                        Matchers.containsString("\"name\":\"Raj - Resume.pdf\""),
                        Matchers.containsString("\"parents\":[\"folder123\"]"),
                        Matchers.containsString("\"careerpilot\":\"document\""),
                        Matchers.containsString("Content-Type: application/pdf"),
                        Matchers.containsString("%PDF-1.7 fake"))))
                .andRespond(withSuccess("""
                        {"id":"file123","name":"Raj - Resume.pdf","mimeType":"application/pdf","size":"14",
                         "webViewLink":"https://drive.google.com/file/d/file123/view","parents":["folder123"],
                         "appProperties":{"careerpilot":"document"}}
                        """, MediaType.APPLICATION_JSON));

        var file = drive.upload("ya29.token", "Raj - Resume.pdf", "folder123", "application/pdf",
                Map.of("careerpilot", "document"), "%PDF-1.7 fake".getBytes(StandardCharsets.UTF_8));

        assertThat(file.id()).isEqualTo("file123");
        assertThat(file.sizeBytes()).isEqualTo(14L);
        assertThat(file.firstParent()).isEqualTo("folder123");
        server.verify();
    }

    @Test
    void listsWithAnEncodedQuery() {
        String query = "trashed = false and appProperties has { key='careerpilot' and value='document' }";
        server.expect(requestTo(Matchers.startsWith("https://www.googleapis.com/drive/v3/files?")))
                .andExpect(queryParam("q", Matchers.anything()))
                .andExpect(request -> assertThat(decode(request.getURI().getRawQuery())).contains("q=" + query))
                .andRespond(withSuccess("{\"files\":[{\"id\":\"a\",\"name\":\"A.pdf\"}],\"nextPageToken\":\"p2\"}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(Matchers.containsString("pageToken=p2")))
                .andRespond(withSuccess("{\"files\":[{\"id\":\"b\",\"name\":\"B.pdf\"}]}", MediaType.APPLICATION_JSON));

        assertThat(drive.list("t", query, 5)).extracting("id").containsExactly("a", "b");
        server.verify();
    }

    @Test
    void renamesAndTrashesWithPatch() {
        server.expect(requestTo(Matchers.startsWith("https://www.googleapis.com/drive/v3/files/file123")))
                .andExpect(method(HttpMethod.PATCH))
                .andExpect(content().json("{\"trashed\":true}"))
                .andRespond(withSuccess("{\"id\":\"file123\",\"trashed\":true}", MediaType.APPLICATION_JSON));

        assertThat(drive.update("t", "file123", Map.of("trashed", true)).isTrashed()).isTrue();
        server.verify();
    }

    @Test
    void malformedFileIdsNeverReachGoogle() {
        assertThatThrownBy(() -> drive.get("t", "../../about")).isInstanceOf(DriveApiException.class)
                .extracting("status").isEqualTo(404);
        assertThatThrownBy(() -> drive.update("t", "a b", Map.of())).isInstanceOf(DriveApiException.class);
        server.verify();
    }

    @Test
    void errorsCarryStatusAndReasonOnly() {
        server.expect(requestTo(Matchers.startsWith("https://www.googleapis.com/upload/drive/v3/files")))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).body("{\"error\":{\"errors\":[{\"reason\":\"storageQuotaExceeded\"}]}}"));

        assertThatThrownBy(() -> drive.upload("t", "a.pdf", null, "application/pdf", Map.of(), new byte[1]))
                .isInstanceOfSatisfying(DriveApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(403);
                    assertThat(e.reason()).isEqualTo("storageQuotaExceeded");
                    assertThat(DriveErrors.from(e).code()).isEqualTo("DRIVE_STORAGE_FULL");
                });
    }

    @Test
    void downloadsAreSizeLimited() {
        server.expect(requestTo(Matchers.containsString("/drive/v3/files/file123?alt=media")))
                .andRespond(withSuccess(new byte[2048], MediaType.APPLICATION_PDF));

        assertThatThrownBy(() -> drive.download("t", "file123", 1024)).isInstanceOf(DriveApiException.class)
                .extracting("status").isEqualTo(413);
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static String decodeSafe(String value) {
        return UriComponentsBuilder.newInstance().queryParam("x", value).encode().build().getQueryParams().getFirst("x");
    }
}
