package com.careerpilot.backend.resume;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.docengine.PageSize;
import com.careerpilot.backend.resume.ResumeDtos.DiffResponse;
import com.careerpilot.backend.resume.ResumeDtos.ProposalRequest;
import com.careerpilot.backend.resume.ResumeDtos.ResumeRequest;
import com.careerpilot.backend.resume.ResumeDtos.ResumeResponse;
import com.careerpilot.backend.resume.ResumeDtos.ResumeSummary;
import com.careerpilot.backend.resume.ResumeDtos.VersionResponse;
import com.careerpilot.backend.resume.ResumeDtos.VersionSummary;
import com.careerpilot.backend.resume.ResumeVersion.Source;
import com.careerpilot.backend.resume.ResumeVersion.Status;

/**
 * Saved resumes and their versions, always scoped to their owner. Another user's id behaves exactly like a
 * missing one (404).
 *
 * Versions: each save records a SAVED version (history, the newest {@value #MAX_SAVED_VERSIONS} are kept).
 * Proposals (imported JSON, AI suggestions) don't touch the resume until the owner accepts them; restoring an
 * old version records a new SAVED version, so nothing is ever lost by accepting or restoring.
 */
@Service
public class ResumeService {

    static final int MAX_RESUMES_PER_USER = 50;
    static final int MAX_SAVED_VERSIONS = 30;
    static final int MAX_OPEN_PROPOSALS = 20;

    private final ResumeRepository resumes;
    private final ResumeVersionRepository versions;
    private final ResumeDocumentService documents;
    private final ResumeJson json;
    /** careerpilot.resumes.versions-enabled: off = no history rows are written and version endpoints are closed. */
    private final boolean versionsEnabled;

    public ResumeService(ResumeRepository resumes, ResumeVersionRepository versions, ResumeDocumentService documents,
            ResumeJson json, @Value("${careerpilot.resumes.versions-enabled:false}") boolean versionsEnabled) {
        this.versionsEnabled = versionsEnabled;
        this.resumes = resumes;
        this.versions = versions;
        this.documents = documents;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<ResumeSummary> list(UUID userId) {
        return resumes.findAllByUserIdOrderByUpdatedAtDesc(userId).stream().map(this::summary).toList();
    }

    @Transactional(readOnly = true)
    public ResumeResponse get(UUID userId, UUID id) {
        return response(find(userId, id));
    }

    @Transactional
    public ResumeResponse create(UUID userId, ResumeRequest request) {
        if (resumes.countByUserId(userId) >= MAX_RESUMES_PER_USER) {
            throw new ApiException(HttpStatus.CONFLICT, "RESUME_LIMIT_REACHED",
                    "You can keep up to " + MAX_RESUMES_PER_USER + " resumes. Delete one you no longer need.");
        }
        String templateId = documents.template(request.templateId()).id();
        Resume resume = resumes.saveAndFlush(new Resume(userId, request.title().strip(), templateId,
                pageSize(request.pageSize()), json.write(request.data().normalized()), document(request.document())));
        recordVersion(resume, "Created", Source.EDITOR, Status.SAVED);
        return response(resume);
    }

    @Transactional
    public ResumeResponse update(UUID userId, UUID id, ResumeRequest request) {
        Resume resume = find(userId, id);
        String templateId = documents.template(request.templateId()).id();
        resume.update(request.title().strip(), templateId, pageSize(request.pageSize()),
                json.write(request.data().normalized()), document(request.document()));
        resume = resumes.saveAndFlush(resume);
        recordVersion(resume, null, Source.EDITOR, Status.SAVED);
        return response(resume);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        resumes.delete(find(userId, id));
    }

    // ---- versions ----

    @Transactional(readOnly = true)
    public List<VersionSummary> versions(UUID userId, UUID resumeId) {
        Resume resume = find(userId, resumeId);
        if (!versionsEnabled) {
            return List.of();
        }
        return versions.findAllByResumeIdAndUserIdOrderByNumberDesc(resume.getId(), userId).stream()
                .map(v -> new VersionSummary(v.getId(), v.getNumber(), v.getLabel(), v.getSource(), v.getStatus(),
                        v.getStatus() == Status.PROPOSED ? changes(resume, v).size() : null,
                        v.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public VersionResponse version(UUID userId, UUID resumeId, UUID versionId) {
        requireVersions();
        return versionResponse(findVersion(userId, resumeId, versionId));
    }

    /** What would change if this version replaced the current resume. */
    @Transactional(readOnly = true)
    public DiffResponse diff(UUID userId, UUID resumeId, UUID versionId) {
        requireVersions();
        Resume resume = find(userId, resumeId);
        ResumeVersion version = findVersion(userId, resumeId, versionId);
        return new DiffResponse(version.getId(), version.getNumber(), changes(resume, version));
    }

    @Transactional
    public VersionResponse propose(UUID userId, UUID resumeId, ProposalRequest request) {
        requireVersions();
        Resume resume = find(userId, resumeId);
        if (versions.countByResumeIdAndStatus(resume.getId(), Status.PROPOSED) >= MAX_OPEN_PROPOSALS) {
            throw new ApiException(HttpStatus.CONFLICT, "TOO_MANY_PROPOSALS",
                    "This resume has " + MAX_OPEN_PROPOSALS + " suggestions waiting. Accept or discard some first.");
        }
        Source source = request.source() == Source.AI || request.source() == Source.IMPORT ? request.source() : Source.IMPORT;
        String templateId = request.templateId() == null ? resume.getTemplateId() : documents.template(request.templateId()).id();
        PageSize pageSize = request.pageSize() == null ? resume.getPageSize() : request.pageSize();
        String label = request.label() == null || request.label().isBlank()
                ? (source == Source.AI ? "AI suggestion" : "Imported JSON") : request.label().strip();
        if (request.data() == null && request.document() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PROPOSAL_EMPTY", "Send resume \"data\" or a \"document\".");
        }
        // A document-only proposal keeps the current form content; a data-only proposal uses the form
        String data = request.data() != null ? json.write(request.data().normalized()) : resume.getData();
        ResumeVersion version = versions.saveAndFlush(new ResumeVersion(resume.getId(), userId,
                versions.maxNumber(resume.getId()) + 1, label, source, Status.PROPOSED, templateId, pageSize,
                data, document(request.document())));
        return versionResponse(version);
    }

    /**
     * Makes the version the resume's content: a proposal is accepted; an older saved version is restored
     * (recorded as a new saved version).
     */
    @Transactional
    public ResumeResponse accept(UUID userId, UUID resumeId, UUID versionId) {
        requireVersions();
        Resume resume = find(userId, resumeId);
        ResumeVersion version = findVersion(userId, resumeId, versionId);
        resume.update(resume.getTitle(), version.getTemplateId(), version.getPageSize(), version.getData(),
                version.getDocument());
        resume = resumes.saveAndFlush(resume);
        if (version.getStatus() == Status.PROPOSED) {
            version.markAccepted();
            versions.save(version);
        } else {
            recordVersion(resume, "Restored version " + version.getNumber(), Source.RESTORE, Status.SAVED);
        }
        return response(resume);
    }

    /** Throws away a proposal. History entries can't be discarded. */
    @Transactional
    public void discard(UUID userId, UUID resumeId, UUID versionId) {
        requireVersions();
        ResumeVersion version = findVersion(userId, resumeId, versionId);
        if (version.getStatus() != Status.PROPOSED) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_A_PROPOSAL", "Only suggestions can be discarded.");
        }
        versions.delete(version);
    }

    // ---- helpers ----

    Resume find(UUID userId, UUID id) {
        return resumes.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RESUME_NOT_FOUND", "Resume not found."));
    }

    /** True when the resume exists and belongs to the user (used to link Drive uploads to a resume). */
    @Transactional(readOnly = true)
    public boolean isOwnedBy(UUID userId, UUID id) {
        return resumes.findByIdAndUserId(id, userId).isPresent();
    }

    private ResumeVersion findVersion(UUID userId, UUID resumeId, UUID versionId) {
        return versions.findByIdAndResumeIdAndUserId(versionId, resumeId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "VERSION_NOT_FOUND", "Version not found."));
    }

    private void requireVersions() {
        if (!versionsEnabled) {
            throw new ApiException(HttpStatus.NOT_FOUND, "VERSIONS_DISABLED", "Version history is turned off.");
        }
    }

    private void recordVersion(Resume resume, String label, Source source, Status status) {
        if (!versionsEnabled) {
            return;
        }
        versions.saveAndFlush(new ResumeVersion(resume.getId(), resume.getUserId(), versions.maxNumber(resume.getId()) + 1,
                label, source, status, resume.getTemplateId(), resume.getPageSize(), resume.getData(), resume.getDocument()));
        // Keep history bounded: oldest saved versions go first; proposals and accepted proposals are kept
        List<ResumeVersion> saved = versions.findAllByResumeIdAndUserIdOrderByNumberDesc(resume.getId(), resume.getUserId())
                .stream().filter(v -> v.getStatus() == Status.SAVED).toList();
        if (saved.size() > MAX_SAVED_VERSIONS) {
            versions.deleteAll(saved.subList(MAX_SAVED_VERSIONS, saved.size()));
        }
    }

    private ResumeData data(Resume resume) {
        return json.read(resume.getData()).normalized();
    }

    /** A request's document, validated and normalized for storage; null when there is none. */
    private String document(JsonNode document) {
        return document == null || document.isNull() ? null : json.write(documents.normalizeDocument(document));
    }

    /**
     * What would change if the version replaced the resume. Form-only on both sides: a field-level diff of the
     * form data; otherwise both are compared as documents (a form side is converted first).
     */
    private List<ResumeDiff.Change> changes(Resume resume, ResumeVersion version) {
        if (resume.getDocument() == null && version.getDocument() == null) {
            return ResumeDiff.between(data(resume), json.read(version.getData()));
        }
        JsonNode before = resume.getDocument() != null ? json.tree(resume.getDocument())
                : documents.toDocument(resume.getTemplateId(), resume.getPageSize(), data(resume));
        JsonNode after = version.getDocument() != null ? json.tree(version.getDocument())
                : documents.toDocument(version.getTemplateId(), version.getPageSize(), json.read(version.getData()));
        return DocDiff.between(before, after);
    }

    private static PageSize pageSize(PageSize value) {
        return value == null ? PageSize.A4 : value;
    }

    private ResumeSummary summary(Resume resume) {
        ResumeData data = data(resume);
        return new ResumeSummary(resume.getId(), resume.getTitle(), resume.getTemplateId(), resume.getPageSize(),
                data.basics().fullName(),
                versionsEnabled ? (int) versions.countByResumeIdAndStatus(resume.getId(), Status.PROPOSED) : 0,
                resume.getCreatedAt(), resume.getUpdatedAt());
    }

    private ResumeResponse response(Resume resume) {
        return new ResumeResponse(resume.getId(), resume.getTitle(), resume.getTemplateId(), resume.getPageSize(),
                data(resume), json.tree(resume.getDocument()), resume.getCreatedAt(), resume.getUpdatedAt());
    }

    private VersionResponse versionResponse(ResumeVersion v) {
        return new VersionResponse(v.getId(), v.getNumber(), v.getLabel(), v.getSource(), v.getStatus(),
                v.getTemplateId(), v.getPageSize(), json.read(v.getData()).normalized(), json.tree(v.getDocument()),
                v.getCreatedAt());
    }
}
