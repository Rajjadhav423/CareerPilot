import { apiFetch } from "./client";

/** Mirrors EmailTemplateDtos.TemplateResponse */
export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Mirrors EmailTemplateDtos.TemplateRequest */
export type TemplateInput = {
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
};

/** One supported placeholder (the server's allowlist). Mirrors EmailTemplateDtos.MergeFieldResponse */
export type MergeField = {
  key: string;
  placeholder: string;
  label: string;
  description: string;
  sample: string;
};

/** Mirrors EmailTemplateDtos.PreviewResponse */
export type TemplatePreview = {
  subject: string;
  body: string;
  unknownPlaceholders: string[];
};

const BASE = "/api/v1/email-templates";

export function listTemplates(token: string | null) {
  return apiFetch<EmailTemplate[]>(BASE, { token });
}

export function listMergeFields(token: string | null) {
  return apiFetch<MergeField[]>(`${BASE}/merge-fields`, { token });
}

export function createTemplate(input: TemplateInput, token: string | null) {
  return apiFetch<EmailTemplate>(BASE, { method: "POST", json: input, token });
}

export function updateTemplate(id: string, input: TemplateInput, token: string | null) {
  return apiFetch<EmailTemplate>(`${BASE}/${id}`, { method: "PUT", json: input, token });
}

export function duplicateTemplate(id: string, token: string | null) {
  return apiFetch<EmailTemplate>(`${BASE}/${id}/duplicate`, { method: "POST", token });
}

export function deleteTemplate(id: string, token: string | null) {
  return apiFetch<void>(`${BASE}/${id}`, { method: "DELETE", token });
}

export function previewTemplate(input: { subject: string; body: string }, token: string | null) {
  return apiFetch<TemplatePreview>(`${BASE}/preview`, { method: "POST", json: input, token });
}
