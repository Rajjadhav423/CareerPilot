package com.careerpilot.backend.drive;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import tools.jackson.databind.json.JsonMapper;

/**
 * The few Drive v3 calls CareerPilot needs. With the drive.file permission Google itself only lets these
 * calls see files and folders this app created, so there is no way to browse or change the rest of a Drive.
 * Failures surface as {@link DriveApiException}; callers turn them into user-facing errors.
 */
@Component
public class GoogleDriveClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleDriveClient.class);

    static final String FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
    private static final String FILE_FIELDS =
            "id,name,mimeType,size,webViewLink,parents,appProperties,trashed,createdTime,modifiedTime";
    /** Drive file ids are URL-safe base64-like strings; anything else never reaches Google. */
    private static final Pattern FILE_ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");

    public record DriveFile(String id, String name, String mimeType, String size, String webViewLink,
            List<String> parents, Map<String, String> appProperties, Boolean trashed, String createdTime,
            String modifiedTime) {

        public Long sizeBytes() {
            try {
                return size == null ? null : Long.valueOf(size);
            } catch (NumberFormatException e) {
                return null;
            }
        }

        public String firstParent() {
            return parents == null || parents.isEmpty() ? null : parents.getFirst();
        }

        public String appProperty(String key) {
            return appProperties == null ? null : appProperties.get(key);
        }

        public boolean isTrashed() {
            return Boolean.TRUE.equals(trashed);
        }
    }

    public record DriveUser(String emailAddress, String permissionId) {
    }

    private record About(DriveUser user) {
    }

    private record FileList(List<DriveFile> files, String nextPageToken) {
    }

    /** A Drive request failed. {@code reason} is Google's machine-readable reason when known. */
    public static class DriveApiException extends RuntimeException {
        private final int status;
        private final String reason;

        DriveApiException(int status, String reason) {
            super("Drive request failed with status " + status);
            this.status = status;
            this.reason = reason;
        }

        public int status() {
            return status;
        }

        public String reason() {
            return reason;
        }
    }

    private final RestClient restClient;
    private final JsonMapper json;

    public GoogleDriveClient(RestClient.Builder builder, JsonMapper json) {
        this.restClient = builder.baseUrl("https://www.googleapis.com").build();
        this.json = json;
    }

    public DriveUser about(String token) {
        About about = call(() -> restClient.get()
                .uri(uri -> uri.path("/drive/v3/about").queryParam("fields", "user(emailAddress,permissionId)").build())
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .retrieve()
                .body(About.class));
        return about == null ? new DriveUser(null, null) : about.user();
    }

    /** Lists app-visible files matching a Drive query (all pages, up to {@code maxPages} × 100 files). */
    public List<DriveFile> list(String token, String query, int maxPages) {
        java.util.ArrayList<DriveFile> files = new java.util.ArrayList<>();
        String pageToken = null;
        for (int page = 0; page < maxPages; page++) {
            String currentToken = pageToken;
            FileList result = call(() -> restClient.get()
                    .uri(uri -> {
                        uri.path("/drive/v3/files")
                                .queryParam("q", "{q}")
                                .queryParam("fields", "nextPageToken,files(" + FILE_FIELDS + ")")
                                .queryParam("pageSize", 100)
                                .queryParam("spaces", "drive")
                                .queryParam("orderBy", "modifiedTime desc");
                        if (currentToken != null) {
                            uri.queryParam("pageToken", "{pageToken}");
                            return uri.build(Map.of("q", query, "pageToken", currentToken));
                        }
                        return uri.build(Map.of("q", query));
                    })
                    .header(HttpHeaders.AUTHORIZATION, bearer(token))
                    .retrieve()
                    .body(FileList.class));
            if (result == null || result.files() == null) {
                break;
            }
            files.addAll(result.files());
            pageToken = result.nextPageToken();
            if (pageToken == null || pageToken.isBlank()) {
                break;
            }
        }
        return files;
    }

    public DriveFile get(String token, String fileId) {
        requireFileId(fileId);
        return call(() -> restClient.get()
                .uri("/drive/v3/files/{id}?fields={fields}", fileId, FILE_FIELDS)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .retrieve()
                .body(DriveFile.class));
    }

    public DriveFile createFolder(String token, String name, Map<String, String> appProperties) {
        Map<String, Object> metadata = Map.of("name", name, "mimeType", FOLDER_MIME_TYPE, "appProperties", appProperties);
        return call(() -> restClient.post()
                .uri("/drive/v3/files?fields={fields}", FILE_FIELDS)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(metadata)
                .retrieve()
                .body(DriveFile.class));
    }

    /** Multipart upload (metadata + content in one request, fine for files up to a few MB). */
    public DriveFile upload(String token, String name, String parentId, String mimeType,
            Map<String, String> appProperties, byte[] content) {
        if (parentId != null) {
            requireFileId(parentId);
        }
        Map<String, Object> metadata = parentId == null
                ? Map.of("name", name, "mimeType", mimeType, "appProperties", appProperties)
                : Map.of("name", name, "mimeType", mimeType, "appProperties", appProperties, "parents", List.of(parentId));
        String boundary = "careerpilot-" + UUID.randomUUID();
        byte[] body = multipartRelated(boundary, json.writeValueAsString(metadata), mimeType, content);
        return call(() -> restClient.post()
                .uri("/upload/drive/v3/files?uploadType=multipart&fields={fields}", FILE_FIELDS)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.parseMediaType("multipart/related; boundary=" + boundary))
                .body(body)
                .retrieve()
                .body(DriveFile.class));
    }

    /** Partial metadata update, e.g. {"name": …} to rename or {"trashed": true} to move to Drive's trash. */
    public DriveFile update(String token, String fileId, Map<String, Object> changes) {
        requireFileId(fileId);
        return call(() -> restClient.patch()
                .uri("/drive/v3/files/{id}?fields={fields}", fileId, FILE_FIELDS)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(changes)
                .retrieve()
                .body(DriveFile.class));
    }

    /** File content, refusing anything larger than {@code maxBytes}. */
    public byte[] download(String token, String fileId, long maxBytes) {
        requireFileId(fileId);
        return call(() -> restClient.get()
                .uri("/drive/v3/files/{id}?alt=media", fileId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .exchange((request, response) -> {
                    if (response.getStatusCode().isError()) {
                        throw new DriveApiException(response.getStatusCode().value(), null);
                    }
                    try (InputStream in = response.getBody()) {
                        return readLimited(in, maxBytes);
                    }
                }));
    }

    private static byte[] readLimited(InputStream in, long maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long total = 0;
        int read;
        while ((read = in.read(buffer)) != -1) {
            total += read;
            if (total > maxBytes) {
                throw new DriveApiException(413, "fileTooLarge");
            }
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }

    private static byte[] multipartRelated(String boundary, String metadataJson, String mimeType, byte[] content) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(content.length + 1024);
        String head = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + metadataJson
                + "\r\n--" + boundary + "\r\nContent-Type: " + mimeType + "\r\n\r\n";
        out.writeBytes(head.getBytes(StandardCharsets.UTF_8));
        out.writeBytes(content);
        out.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private <T> T call(java.util.function.Supplier<T> request) {
        try {
            return request.get();
        } catch (DriveApiException e) {
            log.warn("Google Drive request failed with status {}", e.status());
            throw e;
        } catch (RestClientResponseException e) {
            String body = e.getResponseBodyAsString();
            String reason = body.contains("storageQuotaExceeded") ? "storageQuotaExceeded"
                    : body.contains("insufficientPermissions") || body.contains("ACCESS_TOKEN_SCOPE_INSUFFICIENT")
                            ? "insufficientPermissions" : null;
            // Status and reason only: never tokens, file names or document content.
            log.warn("Google Drive request failed with status {}{}", e.getStatusCode().value(),
                    reason == null ? "" : " (" + reason + ")");
            throw new DriveApiException(e.getStatusCode().value(), reason);
        } catch (RestClientException e) {
            if (e.getCause() instanceof DriveApiException drive) {
                throw drive;
            }
            log.warn("Google Drive unreachable: {}", e.getClass().getSimpleName());
            throw new DriveApiException(503, "unreachable");
        }
    }

    private static void requireFileId(String fileId) {
        if (fileId == null || !FILE_ID.matcher(fileId).matches()) {
            throw new DriveApiException(404, "invalidFileId");
        }
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
