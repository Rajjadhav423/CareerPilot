package com.careerpilot.backend.resume;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.careerpilot.backend.common.ApiException;
import com.careerpilot.backend.document.PageSize;
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

    public ResumeService(ResumeRepository resumes, ResumeVersionRepository versions, ResumeDocumentService documents,
            ResumeJson json) {
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
                pageSize(request.pageSize()), json.write(request.data().normalized())));
        recordVersion(resume, "Created", Source.EDITOR, Status.SAVED);
        return response(resume);
    }

    @Transactional
    public ResumeResponse update(UUID userId, UUID id, ResumeRequest request) {
        Resume resume = find(userId, id);
        String templateId = documents.template(request.templateId()).id();
        resume.update(request.title().strip(), templateId, pageSize(request.pageSize()),
                json.write(request.data().normalized()));
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
        ResumeData current = data(resume);
        return versions.findAllByResumeIdAndUserIdOrderByNumberDesc(resume.getId(), userId).stream()
                .map(v -> new VersionSummary(v.getId(), v.getNumber(), v.getLabel(), v.getSource(), v.getStatus(),
                        v.getStatus() == Status.PROPOSED ? ResumeDiff.between(current, json.read(v.getData())).size() : null,
                        v.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public VersionResponse version(UUID userId, UUID resumeId, UUID versionId) {
        return versionResponse(findVersion(userId, resumeId, versionId));
    }

    /** What would change if this version replaced the current resume. */
    @Transactional(readOnly = true)
    public DiffResponse diff(UUID userId, UUID resumeId, UUID versionId) {
        Resume resume = find(userId, resumeId);
        ResumeVersion version = findVersion(userId, resumeId, versionId);
        return new DiffResponse(version.getId(), version.getNumber(),
                ResumeDiff.between(data(resume), json.read(version.getData())));
    }

    @Transactional
    public VersionResponse propose(UUID userId, UUID resumeId, ProposalRequest request) {
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
        ResumeVersion version = versions.saveAndFlush(new ResumeVersion(resume.getId(), userId,
                versions.maxNumber(resume.getId()) + 1, label, source, Status.PROPOSED, templateId, pageSize,
                json.write(request.data().normalized())));
        return versionResponse(version);
    }

    /**
     * Makes the version the resume's content: a proposal is accepted; an older saved version is restored
     * (recorded as a new saved version).
     */
    @Transactional
    public ResumeResponse accept(UUID userId, UUID resumeId, UUID versionId) {
        Resume resume = find(userId, resumeId);
        ResumeVersion version = findVersion(userId, resumeId, versionId);
        resume.update(resume.getTitle(), version.getTemplateId(), version.getPageSize(), version.getData());
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

    private void recordVersion(Resume resume, String label, Source source, Status status) {
        versions.saveAndFlush(new ResumeVersion(resume.getId(), resume.getUserId(), versions.maxNumber(resume.getId()) + 1,
                label, source, status, resume.getTemplateId(), resume.getPageSize(), resume.getData()));
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

    private static PageSize pageSize(PageSize value) {
        return value == null ? PageSize.A4 : value;
    }

    private ResumeSummary summary(Resume resume) {
        ResumeData data = data(resume);
        return new ResumeSummary(resume.getId(), resume.getTitle(), resume.getTemplateId(), resume.getPageSize(),
                data.basics().fullName(), (int) versions.countByResumeIdAndStatus(resume.getId(), Status.PROPOSED),
                resume.getCreatedAt(), resume.getUpdatedAt());
    }

    private ResumeResponse response(Resume resume) {
        return new ResumeResponse(resume.getId(), resume.getTitle(), resume.getTemplateId(), resume.getPageSize(),
                data(resume), resume.getCreatedAt(), resume.getUpdatedAt());
    }

    private VersionResponse versionResponse(ResumeVersion v) {
        return new VersionResponse(v.getId(), v.getNumber(), v.getLabel(), v.getSource(), v.getStatus(),
                v.getTemplateId(), v.getPageSize(), json.read(v.getData()).normalized(), v.getCreatedAt());
    }
}
