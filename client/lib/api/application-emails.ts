import type { JobStatus } from "@/lib/jobs/statuses";

import { apiFetch } from "./client";

/** Mirrors ApplicationEmailDtos.MissingField */
export type MissingField = { key: string; placeholder: string; label: string };

/** Mirrors ApplicationEmailDtos.ComposeResponse: a draft. Editing it never changes the template. */
export type ComposedEmail = {
  templateId: string | null;
  templateName: string | null;
  subject: string;
  body: string;
  missingFields: MissingField[];
  unknownPlaceholders: string[];
};

/** Mirrors ApplicationEmailDtos.SendRequest */
export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  templateId: string | null;
  /** One of the user's saved resumes, rendered and attached as a PDF by the server */
  resumeId?: string | null;
  /** One of the user's CareerPilot PDFs in Google Drive, attached unchanged */
  driveDocumentId?: string | null;
  /** The user reviewed the email and pressed the final Send. The server refuses without it. */
  confirmed: boolean;
};

/** Mirrors ApplicationEmailDtos.SendResponse */
export type SendEmailResult = { id: string; sentAt: string; jobStatus: JobStatus; appliedAt: string | null };

/** Mirrors ApplicationEmailDtos.SentEmailResponse */
export type SentEmail = { id: string; recipient: string; subject: string; templateId: string | null; sentAt: string };

export function composeApplicationEmail(
  jobId: string,
  input: { templateId: string | null; timeZone: string },
  token: string | null,
) {
  return apiFetch<ComposedEmail>(`/api/v1/jobs/${jobId}/emails/compose`, { method: "POST", json: input, token });
}

export function sendApplicationEmail(jobId: string, input: SendEmailInput, token: string | null) {
  return apiFetch<SendEmailResult>(`/api/v1/jobs/${jobId}/emails`, { method: "POST", json: input, token });
}

export function listSentEmails(jobId: string, token: string | null) {
  return apiFetch<SentEmail[]>(`/api/v1/jobs/${jobId}/emails`, { token });
}
