import { apiFetch, apiFetchResponse } from "./client";

/**
 * docEngine document (schema version 3). The full rules live on the server: GET /api/v1/docs/rules
 * (server/src/main/resources/docengine/spec/doc-rules.md). The type is intentionally loose: the server validates.
 */
export type DocDocument = {
  schemaVersion: 3;
  document: "resume" | "coverLetter";
  preset?: string | null;
  meta?: { title?: string | null; author?: string | null; subject?: string | null; language?: string | null };
  page?: { size?: "A4" | "LETTER"; margin?: string; maxPages?: number; pageNumbers?: boolean };
  styles?: Record<string, Record<string, string>>;
  sections: DocSection[];
};

export type DocSection = { id: string; title?: string | null; visible?: boolean; style?: Record<string, string>; nodes: DocNode[] };

export type DocNode = {
  id?: string;
  tag: string;
  class?: string;
  style?: Record<string, string>;
  attrs?: Record<string, string>;
  visible?: boolean;
  text?: string;
  html?: string;
  children?: DocNode[];
  role?: string;
  data?: Record<string, string | number | boolean | null>;
};

/** A broken rule (error) or a repaired/advisory one (warning). path is a JSON Pointer into the document. */
export type DocIssue = { path: string; code: string; message: string };

export type DocMode = "strict" | "lenient";

export type DocValidation = {
  valid: boolean;
  errors: DocIssue[];
  warnings: DocIssue[];
  pages: number | null;
  /** The repaired document (lenient mode, when valid) */
  document?: DocDocument;
};

export type DocPreset = { id: string; name: string; description: string; styles: Record<string, Record<string, string>> };

const BASE = "/api/v1/docs";

export function validateDocument(document: unknown, mode: DocMode, token: string | null, signal?: AbortSignal) {
  return apiFetch<DocValidation>(`${BASE}/validate`, { method: "POST", json: { document, mode }, token, signal });
}

/** The PDF (base64) and its page count; the preview draws the pages in the browser. */
export function renderDocumentPages(document: unknown, token: string | null, signal?: AbortSignal) {
  return apiFetch<{ pageCount: number; pdf: string }>(`${BASE}/render/pages`, {
    method: "POST",
    json: { document },
    token,
    signal,
  });
}

export function renderDocumentPdf(document: unknown, fileName: string | undefined, token: string | null) {
  return apiFetchResponse(`${BASE}/render/pdf`, "application/pdf", { method: "POST", json: { document, fileName }, token });
}

/** The rules as Markdown, for people and AI assistants. */
export async function getDocumentRules(token: string | null) {
  const response = await apiFetchResponse(`${BASE}/rules`, "text/markdown", { token });
  return response.text();
}

export function listDocumentPresets(token: string | null) {
  return apiFetch<DocPreset[]>(`${BASE}/presets`, { token });
}

/** True for JSON that looks like a docEngine document (rather than the form format). */
export function isDocDocument(value: unknown): value is DocDocument {
  return typeof value === "object" && value !== null && (value as { schemaVersion?: unknown }).schemaVersion === 3;
}
