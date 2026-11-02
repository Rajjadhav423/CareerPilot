"use client";

import { useMemo } from "react";

import type { SentEmailWithJob } from "@/lib/api/application-emails";
import { useAllSentEmails } from "@/lib/email/use-application-emails";
import { useAllowReplyTracking, useGmailStatus } from "@/lib/email/use-gmail";
import { Button } from "@/components/ui/button";
import { SectionMessage } from "@/components/ui/section-message";
import { EmailStatusLozenge } from "@/components/applications/email-status";

/** The newest sent email per job (one shared query for the whole board). */
function useLatestEmailByJob() {
  const emails = useAllSentEmails();
  return useMemo(() => {
    const byJob = new Map<string, SentEmailWithJob>();
    // Newest first from the API, so the first one per job wins
    for (const email of emails.data ?? []) if (email.job && !byJob.has(email.job.id)) byJob.set(email.job.id, email);
    return byJob;
  }, [emails.data]);
}

/** Delivered / Opened / Replied / Bounced for the job's latest application email; nothing if none was sent. */
export function JobEmailStatus({ jobId }: { jobId: string }) {
  const email = useLatestEmailByJob().get(jobId);
  return email ? <EmailStatusLozenge email={email} /> : null;
}

/** Asks for the headers-only Gmail permission once, so bounces and replies show on the board. */
export function ReplyTrackingNotice({ className }: { className?: string }) {
  const gmail = useGmailStatus();
  const allow = useAllowReplyTracking();
  if (!gmail.data?.canSend || gmail.data.canTrack) return null;
  return (
    <SectionMessage appearance="information" title="See which applications got replies" className={className}>
      <p>
        Allow CareerPilot to read message headers (sender and date, never the content) in the threads of emails it sent.
        Jobs then show Delivered, Bounced or Replied.
      </p>
      <Button className="mt-2" isLoading={allow.isPending} onClick={() => allow.mutate()}>
        Allow reply tracking
      </Button>
      {allow.error && <p className="mt-2 text-danger-text">{allow.error.message}</p>}
    </SectionMessage>
  );
}
