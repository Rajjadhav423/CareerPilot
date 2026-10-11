package com.careerpilot.backend.gmail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.restclient.test.autoconfigure.RestClientTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.gmail.ClerkGoogleAccounts.GoogleAccessToken;

@RestClientTest(GmailApiClient.class)
class GmailApiClientTest {

    private static final GoogleAccessToken TOKEN =
            new GoogleAccessToken("ya29.token", Set.of(ClerkGoogleAccounts.GMAIL_SEND_SCOPE));

    @Autowired
    private GmailApiClient gmail;

    @Autowired
    private MockRestServiceServer server;

    @Test
    void sendsBase64UrlEncodedMessageWithBearerToken() {
        String message = "To: hr@company.com\r\nSubject: Hi\r\n\r\nBody";
        String expectedRaw = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(message.getBytes(StandardCharsets.UTF_8));
        server.expect(requestTo("https://gmail.googleapis.com/gmail/v1/users/me/messages/send"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer ya29.token"))
                .andExpect(jsonPath("$.raw").value(expectedRaw))
                .andRespond(withSuccess("{\"id\": \"msg_123\", \"threadId\": \"thr_9\", \"labelIds\": [\"SENT\"]}",
                        MediaType.APPLICATION_JSON));

        var sent = gmail.send(TOKEN, message);

        assertThat(sent.messageId()).isEqualTo("msg_123");
        assertThat(sent.threadId()).isEqualTo("thr_9");
        server.verify();
    }

    @ParameterizedTest
    @CsvSource({
        "401, GMAIL_AUTH_FAILED",
        "403, GMAIL_PERMISSION_MISSING",
        "400, GMAIL_REJECTED",
        "429, GMAIL_UNAVAILABLE",
        "503, GMAIL_UNAVAILABLE"
    })
    void gmailErrorsBecomeClearCodes(int status, String code) {
        server.expect(requestTo("https://gmail.googleapis.com/gmail/v1/users/me/messages/send"))
                .andRespond(withStatus(HttpStatus.valueOf(status)).body("{\"error\": {\"message\": \"secret detail\"}}"));

        assertThatThrownBy(() -> gmail.send(TOKEN, "To: a@b.co\r\n\r\nx"))
                .isInstanceOf(ApiException.class)
                .hasMessageNotContaining("secret detail")
                .extracting("code").isEqualTo(code);
    }

    @Test
    void responseWithoutMessageIdIsNotTreatedAsSent() {
        server.expect(requestTo("https://gmail.googleapis.com/gmail/v1/users/me/messages/send"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> gmail.send(TOKEN, "To: a@b.co\r\n\r\nx"))
                .extracting("code").isEqualTo("GMAIL_UNAVAILABLE");
    }
}
