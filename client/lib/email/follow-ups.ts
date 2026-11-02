import type { SentEmailWithJob } from "@/lib/api/application-emails";
import type { Job } from "@/lib/api/jobs";

const DAY = 24 * 60 * 60 * 1000;

/** No reply this long after the last email: time to follow up */
export const FOLLOW_UP_AFTER_DAYS = 7;
/** At most this many follow-ups per application; after that, move on */
export const MAX_FOLLOW_UPS = 2;

/**
 * - due: the last email got no reply for FOLLOW_UP_AFTER_DAYS (followUpNumber: 1 = first follow-up)
 * - bounced: the last email bounced; find another address
 * - no-email: marked Applied without an email from CareerPilot and unchanged for FOLLOW_UP_AFTER_DAYS
 */
export type FollowUp =
  | { kind: "due"; job: Job; lastEmail: SentEmailWithJob; days: number; followUpNumber: number }
  | { kind: "bounced"; job: Job; lastEmail: SentEmailWithJob; days: number }
  | { kind: "no-email"; job: Job; days: number };

/**
 * Applications waiting on the user, oldest first, from the sent emails' tracking. Only jobs still in Applied count:
 * a reply, an interview or a rejection means the conversation moved on. Replies are read from the Gmail thread, so
 * jobs whose emails were sent before reply tracking was allowed may show as due although HR answered.
 */
export function followUpsDue(jobs: Job[], emails: SentEmailWithJob[], now: number): FollowUp[] {
  const byJob = new Map<string, SentEmailWithJob[]>();
  for (const email of emails) {
    if (!email.job) continue;
    byJob.set(email.job.id, [...(byJob.get(email.job.id) ?? []), email]);
  }

  const due: FollowUp[] = [];
  for (const job of jobs) {
    if (job.status !== "APPLIED" || job.archived) continue;
    const sent = (byJob.get(job.id) ?? []).sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
    if (sent.length === 0) {
      const days = Math.floor((now - Date.parse(job.updatedAt)) / DAY);
      if (days >= FOLLOW_UP_AFTER_DAYS) due.push({ kind: "no-email", job, days });
      continue;
    }
    if (sent.some((email) => email.status === "REPLIED")) continue;
    const lastEmail = sent[sent.length - 1]!;
    const days = Math.floor((now - Date.parse(lastEmail.sentAt)) / DAY);
    if (lastEmail.status === "BOUNCED") due.push({ kind: "bounced", job, lastEmail, days });
    else if (days >= FOLLOW_UP_AFTER_DAYS && sent.length <= MAX_FOLLOW_UPS) {
      due.push({ kind: "due", job, lastEmail, days, followUpNumber: sent.length });
    }
  }
  return due.sort((a, b) => b.days - a.days);
}
