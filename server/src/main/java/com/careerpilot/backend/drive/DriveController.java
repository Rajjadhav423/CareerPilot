package com.careerpilot.backend.drive;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.careerpilot.backend.drive.DriveDtos.ConnectResponse;
import com.careerpilot.backend.drive.DriveDtos.CreateFolderRequest;
import com.careerpilot.backend.drive.DriveDtos.DriveDocumentResponse;
import com.careerpilot.backend.drive.DriveDtos.DriveFolder;
import com.careerpilot.backend.drive.DriveDtos.DriveStatus;
import com.careerpilot.backend.drive.DriveDtos.RenameRequest;
import com.careerpilot.backend.drive.DriveDtos.SelectFolderRequest;
import com.careerpilot.backend.user.CurrentUserService;
import com.careerpilot.backend.user.User;

/**
 * The signed-in user's Google Drive settings and the documents CareerPilot stored there.
 * Google access comes from Clerk (like Gmail); CareerPilot stores no Google tokens.
 */
@RestController
@RequestMapping("/api/v1/drive")
public class DriveController {

    private final DriveConnectionService connections;
    private final DriveDocumentService documents;
    private final CurrentUserService currentUsers;

    public DriveController(DriveConnectionService connections, DriveDocumentService documents,
            CurrentUserService currentUsers) {
        this.connections = connections;
        this.documents = documents;
        this.currentUsers = currentUsers;
    }

    @GetMapping("/status")
    public DriveStatus status(@AuthenticationPrincipal Jwt jwt) {
        return connections.status(user(jwt));
    }

    /** Switches Drive on; says whether the browser still needs to ask Google (via Clerk) for drive.file. */
    @PostMapping("/connect")
    public ConnectResponse connect(@AuthenticationPrincipal Jwt jwt) {
        return connections.connect(user(jwt));
    }

    /** Switches Drive off in CareerPilot. Files already in Drive stay there. */
    @DeleteMapping("/connection")
    public ResponseEntity<Void> disconnect(@AuthenticationPrincipal Jwt jwt) {
        connections.disconnect(user(jwt));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/folders")
    public List<DriveFolder> folders(@AuthenticationPrincipal Jwt jwt) {
        return connections.folders(user(jwt));
    }

    @PostMapping("/folders")
    public ResponseEntity<DriveFolder> createFolder(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateFolderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(connections.createFolder(user(jwt), request.name()));
    }

    @PutMapping("/folder")
    public DriveFolder selectFolder(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SelectFolderRequest request) {
        return connections.selectFolder(user(jwt), request.folderId());
    }

    @GetMapping("/documents")
    public List<DriveDocumentResponse> documents(@AuthenticationPrincipal Jwt jwt) {
        return documents.list(user(jwt));
    }

    @PatchMapping("/documents/{id}")
    public DriveDocumentResponse rename(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody RenameRequest request) {
        return documents.rename(user(jwt), id, request.name());
    }

    /** Moves the file to the Drive trash. Requires {@code ?confirm=true}. */
    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @RequestParam(defaultValue = "false") boolean confirm) {
        documents.trash(user(jwt), id, confirm);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/documents/{id}/download")
    public ResponseEntity<byte[]> download(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        var file = documents.download(user(jwt), id);
        MediaType type = "application/pdf".equals(file.mimeType()) ? MediaType.APPLICATION_PDF : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.name(), StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(file.content());
    }

    private User user(Jwt jwt) {
        return currentUsers.resolve(jwt);
    }
}
