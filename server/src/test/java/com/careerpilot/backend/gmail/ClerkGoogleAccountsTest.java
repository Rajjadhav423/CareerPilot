package com.careerpilot.backend.gmail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.restclient.test.autoconfigure.RestClientTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.client.MockRestServiceServer;

import com.careerpilot.backend.auth.ClerkProperties;
import com.careerpilot.backend.common.ApiException;

@RestClientTest(ClerkGoogleAccounts.class)
@EnableConfigurationProperties(ClerkProperties.class)
@TestPropertySource(properties = "careerpilot.clerk.secret-key=sk_test_secret")
class ClerkGoogleAccountsTest {

    @Autowired
    private ClerkGoogleAccounts accounts;

    @Autowired
    private MockRestServiceServer server;

    @Test
    void readsAccessTokenWithSecretKeyAndParsesScopes() {
        server.expect(requestTo("https://api.clerk.com/v1/users/user_1/oauth_access_tokens/oauth_google?paginated=true"))
                .andExpect(header("Authorization", "Bearer sk_test_secret"))
                .andRespond(withSuccess("""
                        {"data": [{"object": "oauth_access_token", "token": "ya29.secret-google-token",
                          "provider": "oauth_google", "scopes": ["openid", "https://www.googleapis.com/auth/gmail.send"],
                          "expires_at": 1791700000}], "total_count": 1}
                        """, MediaType.APPLICATION_JSON));

        var token = accounts.findAccessToken("user_1").orElseThrow();

        assertThat(token.value()).isEqualTo("ya29.secret-google-token");
        assertThat(token.canSendGmail()).isTrue();
        assertThat(token.toString()).doesNotContain("ya29").contains("<redacted>");
        server.verify();
    }

    @Test
    void noGoogleConnectionMeansEmpty() {
        server.expect(requestTo("https://api.clerk.com/v1/users/user_1/oauth_access_tokens/oauth_google?paginated=true"))
                .andRespond(withSuccess("{\"data\": [], \"total_count\": 0}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.clerk.com/v1/users/user_2/oauth_access_tokens/oauth_google?paginated=true"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertThat(accounts.findAccessToken("user_1")).isEmpty();
        assertThat(accounts.findAccessToken("user_2")).isEmpty();
    }

    @Test
    void readsGoogleAccountAndApprovedScopes() {
        server.expect(requestTo("https://api.clerk.com/v1/users/user_1"))
                .andRespond(withSuccess("""
                        {"id": "user_1", "external_accounts": [
                          {"provider": "oauth_github", "email_address": "x@github.example"},
                          {"provider": "oauth_google", "email_address": "raj@gmail.com",
                           "approved_scopes": "email openid profile https://www.googleapis.com/auth/gmail.send"}]}
                        """, MediaType.APPLICATION_JSON));

        var account = accounts.findGoogleAccount("user_1").orElseThrow();

        assertThat(account.email()).isEqualTo("raj@gmail.com");
        assertThat(account.canSendGmail()).isTrue();
    }

    @Test
    void clerkOutageIsReportedWithoutDetails() {
        server.expect(requestTo("https://api.clerk.com/v1/users/user_1"))
                .andRespond(withServerError().body("{\"internal\": \"details\"}"));

        assertThatThrownBy(() -> accounts.findGoogleAccount("user_1"))
                .isInstanceOf(ApiException.class)
                .hasMessageNotContaining("details")
                .extracting("code").isEqualTo("GMAIL_UNAVAILABLE");
    }
}
