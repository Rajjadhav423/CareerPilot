package com.careerpilot.backend.gmail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;

class MimeMessageBuilderTest {

    @Test
    void buildsMultipartMessageWithBothParts() {
        String message = MimeMessageBuilder.build("hr@company.com", "Application: Backend Engineer",
                "Hello,\nI'd like to apply.\n\nRaj");

        assertThat(message).contains("To: hr@company.com\r\n")
                .contains("Subject: Application: Backend Engineer\r\n")
                .contains("MIME-Version: 1.0\r\n")
                .contains("Content-Type: multipart/alternative;")
                .doesNotContain("From:");
        assertThat(decodePart(message, "text/plain")).isEqualTo("Hello,\r\nI'd like to apply.\r\n\r\nRaj");
        assertThat(decodePart(message, "text/html")).contains("Hello,<br>\r\nI&#39;d like to apply.");
    }

    @Test
    void htmlPartEscapesMarkupFromMergedValues() {
        String message = MimeMessageBuilder.build("hr@company.com", "Hi",
                "Company: <script>alert(1)</script> & \"Acme\"");

        String html = decodePart(message, "text/html");
        assertThat(html).contains("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Acme&quot;")
                .doesNotContain("<script>");
    }

    @Test
    void rejectsLineBreaksInHeadersToPreventInjection() {
        assertThatThrownBy(() -> MimeMessageBuilder.build("hr@company.com\r\nBcc: everyone@x.com", "Hi", "Body"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MimeMessageBuilder.build("hr@company.com", "Hi\nBcc: everyone@x.com", "Body"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void encodesNonAsciiSubject() {
        String encoded = MimeMessageBuilder.encodeHeader("Application – बैकएंड इंजीनियर");

        assertThat(encoded).startsWith("=?UTF-8?B?").endsWith("?=");
        String decoded = Pattern.compile("=\\?UTF-8\\?B\\?([^?]*)\\?=").matcher(encoded).results()
                .map(m -> new String(Base64.getDecoder().decode(m.group(1)), StandardCharsets.UTF_8))
                .reduce("", String::concat);
        assertThat(decoded).isEqualTo("Application – बैकएंड इंजीनियर");
        encoded.lines().forEach(line -> assertThat(line.trim().length()).isLessThanOrEqualTo(76));
    }

    private static String decodePart(String message, String contentType) {
        Matcher matcher = Pattern.compile("Content-Type: " + Pattern.quote(contentType)
                + "; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--").matcher(message);
        assertThat(matcher.find()).as(contentType + " part").isTrue();
        return new String(Base64.getMimeDecoder().decode(matcher.group(1)), StandardCharsets.UTF_8);
    }
}
