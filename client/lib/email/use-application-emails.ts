"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  composeApplicationEmail,
  getSentEmailStatuses,
  listAllSentEmails,
  listSentEmails,
  sendApplicationEmail,
  type SendEmailInput,
  type SentEmailWithJob,
} from "@/lib/api/application-emails";

const sentKey = (jobId: string) => ["jobs", jobId, "emails"] as const;

/** Fills a template for one job. A mutation, not a query: each run gives a fresh draft the user then edits. */
export function useComposeEmail(jobId: string) {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (templateId: string | null) =>
      composeApplicationEmail(
        jobId,
        { templateId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        await getToken(),
      ),
  });
}

/** Emails already sent for this job (newest first). */
export function useSentEmails(jobId: string, enabled = true) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: sentKey(jobId),
    queryFn: async () => listSentEmails(jobId, await getToken()),
    enabled: enabled && isLoaded && !!isSignedIn,
  });
}

const EMAILS_KEY = ["emails"] as const;
/** How often rows that can still change are checked again */
const LIVE_POLL_MS = 60_000;
/** Rows stop being watched this long after sending (replies to older emails show on the next page load) */
const LIVE_FOR_MS = 7 * 24 * 60 * 60_000;
/** The status endpoint takes at most this many ids */
const MAX_LIVE = 20;

/** Rows whose status can still change: recent, and not already replied to or bounced. */
function liveIds(emails: SentEmailWithJob[] | undefined) {
  // No data while prerendering, so the clock is only read in the browser
  if (!emails?.length) return [];
  const now = Date.now();
  return emails
    .filter((email) => email.status !== "REPLIED" && email.status !== "BOUNCED"
      && now - new Date(email.sentAt).getTime() < LIVE_FOR_MS)
    .slice(0, MAX_LIVE)
    .map((email) => email.id);
}

/**
 * Every sent email with its tracking. The list loads once; after that only the rows that can still change are
 * polled (one small request a minute, paused while the tab is hidden) and merged into the list.
 */
export function useAllSentEmails() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const emails = useQuery({
    queryKey: EMAILS_KEY,
    queryFn: async () => listAllSentEmails(await getToken()),
    enabled: isLoaded && !!isSignedIn,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const ids = liveIds(emails.data);
  useQuery({
    // Shared by every component that shows a status: one poll per page, whatever the number of rows on it
    queryKey: [...EMAILS_KEY, "status", ids],
    queryFn: async () => {
      const fresh = await getSentEmailStatuses(ids, await getToken());
      const byId = new Map(fresh.map((email) => [email.id, email]));
      queryClient.setQueryData<SentEmailWithJob[]>(EMAILS_KEY, (current) =>
        current?.map((email) => {
          const update = byId.get(email.id);
          return update ? { ...email, ...update } : email;
        }));
      return fresh;
    },
    enabled: isLoaded && !!isSignedIn && ids.length > 0,
    staleTime: LIVE_POLL_MS,
    refetchInterval: LIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });

  return emails;
}

/** Sends through the user's Gmail. The server marks the job Applied only after Gmail accepts the message. */
export function useSendEmail(jobId: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendEmailInput) => sendApplicationEmail(jobId, input, await getToken()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}
