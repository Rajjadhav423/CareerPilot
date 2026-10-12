import { apiFetch, apiFetchResponse } from "./client";
import type { DocDocument } from "./docs";

export type PageSize = "A4" | "LETTER";

export type SectionType = "entries" | "text" | "list" | "skills";

/** Mirrors ResumeData.Entry: a job, degree, project, certification… */
export type ResumeEntry = {
  id?: string;
  title: string;
  subtitle?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean | null;
  url?: string | null;
  /** Formatted text: **bold**, *italic*, [label](https://…) */
  description?: string | null;
  /** Formatted text, one bullet each */
  bullets?: string[];
  visible?: boolean | null;
};

export type ResumeListItem = { id?: string; text: string; visible?: boolean | null };

export type ResumeSkillGroup = { id?: string; name?: string | null; keywords?: string[]; visible?: boolean | null };

/** Mirrors ResumeData.Section. Only the field matching `type` is used. */
export type ResumeSection = {
  id?: string;
  type: SectionType;
  title: string;
  visible?: boolean | null;
  entries?: ResumeEntry[];
  content?: string | null;
  items?: ResumeListItem[];
  groups?: ResumeSkillGroup[];
};

/** Page margins in millimetres (5–40). Missing values use the template default: 15 top, 16 elsewhere. */
export type ResumeLayout = {
  marginTop?: number | null;
  marginRight?: number | null;
  marginBottom?: number | null;
  marginLeft?: number | null;
};

/** Mirrors ResumeData.java (schema version 2). JSON Schema: GET /api/v1/resumes/schema */
export type ResumeData = {
  schemaVersion?: 2;
  basics: {
    fullName: string;
    headline?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    links?: { label?: string | null; url: string }[];
  };
  sections?: ResumeSection[];
  layout?: ResumeLayout | null;
};

export type ResumeTemplate = { id: string; name: string; description: string };

export type ResumeSummary = {
  id: string;
  title: string;
  templateId: string;
  pageSize: PageSize;
  fullName: string | null;
  /** Suggestions (imported JSON, AI) waiting for review */
  pendingProposals: number;
  createdAt: string;
  updatedAt: string;
};

/** `document`: a docEngine document; when set it is what gets rendered (the form `data` is kept alongside). */
export type Resume = Omit<ResumeSummary, "fullName" | "pendingProposals"> & { data: ResumeData; document: DocDocument | null };

export type ResumeInput = { title: string; templateId: string; pageSize: PageSize; data: ResumeData; document?: DocDocument | null };

export type RenderInput = { templateId: string; pageSize: PageSize; data: ResumeData; fileName?: string; document?: DocDocument | null };

export type VersionSource = "EDITOR" | "IMPORT" | "AI" | "RESTORE";
export type VersionStatus = "SAVED" | "PROPOSED" | "ACCEPTED";

export type ResumeVersionSummary = {
  id: string;
  number: number;
  label: string | null;
  source: VersionSource;
  status: VersionStatus;
  /** Differences from the current resume (proposals only) */
  changes: number | null;
  createdAt: string;
};

export type ResumeVersion = Omit<ResumeVersionSummary, "changes"> & {
  templateId: string;
  pageSize: PageSize;
  data: ResumeData;
  document: DocDocument | null;
};

/** Mirrors ResumeDiff.Change */
export type ResumeChange = {
  kind: "ADDED" | "REMOVED" | "CHANGED" | "MOVED" | "SHOWN" | "HIDDEN";
  where: string;
  field: string | null;
  before: string | null;
  after: string | null;
};

export type ProposalInput = {
  label?: string;
  source?: "IMPORT" | "AI";
  templateId?: string;
  pageSize?: PageSize;
  /** The form format; or send a docEngine `document` instead (or both) */
  data?: ResumeData;
  document?: DocDocument;
};

export const RESUME_LIMITS = {
  sections: 25,
  entries: 40,
  bullets: 20,
  items: 50,
  groups: 30,
  links: 6,
} as const;

const BASE = "/api/v1/resumes";

export function listResumeTemplates(token: string | null) {
  return apiFetch<ResumeTemplate[]>(`${BASE}/templates`, { token });
}

export function listResumes(token: string | null) {
  return apiFetch<ResumeSummary[]>(BASE, { token });
}

export function getResume(id: string, token: string | null) {
  return apiFetch<Resume>(`${BASE}/${id}`, { token });
}

export function createResume(input: ResumeInput, token: string | null) {
  return apiFetch<Resume>(BASE, { method: "POST", json: input, token });
}

export function updateResume(id: string, input: ResumeInput, token: string | null) {
  return apiFetch<Resume>(`${BASE}/${id}`, { method: "PUT", json: input, token });
}

export function deleteResume(id: string, token: string | null) {
  return apiFetch<void>(`${BASE}/${id}`, { method: "DELETE", token });
}

/** The form content as a docEngine document, to continue editing as a document. */
export function convertResumeToDocument(input: RenderInput, token: string | null) {
  return apiFetch<DocDocument>(`${BASE}/document`, { method: "POST", json: input, token });
}

/** The resume JSON Schema, for people and AI assistants. */
export async function getResumeSchema(token: string | null) {
  const response = await apiFetchResponse(`${BASE}/schema`, "application/schema+json", { token });
  return response.text();
}

/** Validates JSON in either format (current or original) and returns it in the current format. */
export function normalizeResumeJson(value: unknown, token: string | null) {
  return apiFetch<ResumeData>(`${BASE}/normalize`, { method: "POST", json: value, token });
}

export function listResumeVersions(id: string, token: string | null) {
  return apiFetch<ResumeVersionSummary[]>(`${BASE}/${id}/versions`, { token });
}

export function getResumeVersion(id: string, versionId: string, token: string | null) {
  return apiFetch<ResumeVersion>(`${BASE}/${id}/versions/${versionId}`, { token });
}

export function getResumeVersionDiff(id: string, versionId: string, token: string | null) {
  return apiFetch<{ versionId: string; number: number; changes: ResumeChange[] }>(
    `${BASE}/${id}/versions/${versionId}/diff`,
    { token },
  );
}

export function proposeResumeVersion(id: string, input: ProposalInput, token: string | null) {
  return apiFetch<ResumeVersion>(`${BASE}/${id}/versions`, { method: "POST", json: input, token });
}

/** Accepts a proposal, or restores an older version. Returns the updated resume. */
export function acceptResumeVersion(id: string, versionId: string, token: string | null) {
  return apiFetch<Resume>(`${BASE}/${id}/versions/${versionId}/accept`, { method: "POST", token });
}

export function discardResumeVersion(id: string, versionId: string, token: string | null) {
  return apiFetch<void>(`${BASE}/${id}/versions/${versionId}`, { method: "DELETE", token });
}

/** Escaped HTML of the document, for the sandboxed preview frame. */
export async function renderResumePreview(input: RenderInput, token: string | null, signal?: AbortSignal) {
  const response = await apiFetchResponse(`${BASE}/render/preview`, "text/html", {
    method: "POST",
    json: input,
    token,
    signal,
  });
  return response.text();
}

/** The PDF's pages as base64 PNG images: a preview that matches the PDF exactly. */
export function renderResumePages(input: RenderInput, token: string | null, signal?: AbortSignal) {
  return apiFetch<{ pageCount: number; pages: string[] }>(`${BASE}/render/pages`, {
    method: "POST",
    json: input,
    token,
    signal,
  });
}

export function renderResumePdf(input: RenderInput, token: string | null) {
  return apiFetchResponse(`${BASE}/render/pdf`, "application/pdf", { method: "POST", json: input, token });
}
