import { apiFetch } from "./client";

/**
 * Mirrors GmailService.GmailStatus. The server never sends Google tokens to the browser: it reads them
 * from Clerk itself when sending.
 */
export type GmailStatus = {
  /** False when the server has no Clerk secret key, so sending is switched off. */
  configured: boolean;
  /** The user signed in with (or connected) a Google account. */
  connected: boolean;
  /** Google granted the gmail.send permission. */
  canSend: boolean;
  /** Google granted gmail.metadata, so bounces and replies are tracked. */
  canTrack: boolean;
  /** Google granted gmail.compose, so emails can be scheduled (they wait as Gmail drafts). */
  canSchedule: boolean;
  googleEmail: string | null;
};

export function getGmailStatus(token: string | null) {
  return apiFetch<GmailStatus>("/api/v1/gmail/status", { token });
}
