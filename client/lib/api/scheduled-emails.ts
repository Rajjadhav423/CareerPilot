import type { SendEmailInput } from "./application-emails";
import { apiFetch } from "./client";

/** SCHEDULED (waiting as a Gmail draft), SENDING, SENT, FAILED (see error) or CANCELLED */
export type ScheduledStatus = "SCHEDULED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";

/** Mirrors the backend's ScheduledEmailResponse */
export type ScheduledEmail = {
  id: string;
  recipient: string;
  subject: string;
  sendAt: string;
  status: ScheduledStatus;
  /** Why it failed, when status is FAILED */
  error: string | null;
  /** The sent email once sent */
  sentEmailId: string | null;
  createdAt: string;
  job: { id: string; title: string; company: string };
};

/** Saves the email as a draft in the user's Gmail and sends it at sendAt (ISO 8601 with a time zone). */
export function scheduleApplicationEmail(jobId: string, input: SendEmailInput & { sendAt: string }, token: string | null) {
  return apiFetch<ScheduledEmail>(`/api/v1/jobs/${jobId}/emails/schedule`, { method: "POST", json: input, token });
}

/** Waiting or failed first (soonest first), then recently sent or cancelled. */
export function listScheduledEmails(token: string | null) {
  return apiFetch<ScheduledEmail[]>("/api/v1/scheduled-emails", { token });
}

export function rescheduleEmail(id: string, sendAt: string, token: string | null) {
  return apiFetch<ScheduledEmail>(`/api/v1/scheduled-emails/${id}`, { method: "PATCH", json: { sendAt }, token });
}

export function sendScheduledNow(id: string, token: string | null) {
  return apiFetch<ScheduledEmail>(`/api/v1/scheduled-emails/${id}/send-now`, { method: "POST", token });
}

/** Cancels it and deletes its draft from Gmail. */
export function cancelScheduledEmail(id: string, token: string | null) {
  return apiFetch<ScheduledEmail>(`/api/v1/scheduled-emails/${id}`, { method: "DELETE", token });
}
