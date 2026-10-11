"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  composeApplicationEmail,
  listSentEmails,
  sendApplicationEmail,
  type SendEmailInput,
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

/** Sends through the user's Gmail. The server marks the job Applied only after Gmail accepts the message. */
export function useSendEmail(jobId: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendEmailInput) => sendApplicationEmail(jobId, input, await getToken()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
