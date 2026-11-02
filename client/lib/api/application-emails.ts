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
  /** A follow-up: the id of this job's earlier email; the new one goes into its Gmail thread */
  replyToId?: string | null;
  /** The user reviewed the email and pressed the final Send. The server refuses without it. */
  confirmed: boolean;
};

/** Mirrors ApplicationEmailDtos.SendResponse */
export type SendEmailResult = { id: string; sentAt: string; jobStatus: JobStatus; appliedAt: string | null };

/** REPLIED, BOUNCED, OPENED, DELIVERED (no bounce came back) or SENT (just accepted by Gmail) */
export type EmailTrackingStatus = "SENT" | "DELIVERED" | "OPENED" | "REPLIED" | "BOUNCED";

/** Mirrors SentEmailResponse: one sent email with its tracking */
export type SentEmail = {
  id: string;
  recipient: string;
  subject: string;
  templateId: string | null;
  sentAt: string;
  status: EmailTrackingStatus;
  deliveryStatus: "SENT" | "DELIVERED" | "BOUNCED";
  bouncedAt: string | null;
  /** False when open tracking was off for this email */
  openTracked: boolean;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  replyCount: number;
  repliedAt: string | null;
  /** Null until reply tracking is allowed (bounces and replies are read from the Gmail thread) */
  checkedAt: string | null;
};

/** A sent email and the job it was for */
export type SentEmailWithJob = SentEmail & { job: { id: string; title: string; company: string } | null };

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

/** Fresh tracking for just these emails (up to 20), e.g. the rows a page is still watching. */
export function getSentEmailStatuses(ids: string[], token: string | null) {
  return apiFetch<SentEmail[]>(`/api/v1/emails/status?ids=${ids.map(encodeURIComponent).join(",")}`, { token });
}

/** Every application email the user sent (newest 100), with tracking. */
export function listAllSentEmails(token: string | null) {
  return apiFetch<SentEmailWithJob[]>("/api/v1/emails", { token });
}
