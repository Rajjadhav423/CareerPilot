"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SendEmailInput } from "@/lib/api/application-emails";
import {
  cancelScheduledEmail,
  listScheduledEmails,
  rescheduleEmail,
  scheduleApplicationEmail,
  sendScheduledNow,
} from "@/lib/api/scheduled-emails";

/** Under "emails": sending or scheduling anything refreshes it, and changes here refresh sent emails and follow-ups. */
const SCHEDULED_KEY = ["emails", "scheduled"] as const;

/** Waiting emails are checked once a minute so a sent one moves to Sent without a reload. */
export function useScheduledEmails() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: SCHEDULED_KEY,
    queryFn: async () => listScheduledEmails(await getToken()),
    enabled: isLoaded && !!isSignedIn,
    refetchInterval: (query) => (query.state.data?.some((email) => email.status === "SCHEDULED" || email.status === "SENDING") ? 60_000 : false),
  });
}

function useRefreshAfter() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["emails"] });
    void queryClient.invalidateQueries({ queryKey: ["jobs"] });
  };
}

export function useScheduleEmail(jobId: string) {
  const { getToken } = useAuth();
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: async (input: SendEmailInput & { sendAt: string }) => scheduleApplicationEmail(jobId, input, await getToken()),
    onSuccess: refresh,
  });
}

export function useRescheduleEmail() {
  const { getToken } = useAuth();
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: async ({ id, sendAt }: { id: string; sendAt: string }) => rescheduleEmail(id, sendAt, await getToken()),
    onSuccess: refresh,
  });
}

export function useSendScheduledNow() {
  const { getToken } = useAuth();
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: async (id: string) => sendScheduledNow(id, await getToken()),
    onSettled: refresh,
  });
}

export function useCancelScheduledEmail() {
  const { getToken } = useAuth();
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: async (id: string) => cancelScheduledEmail(id, await getToken()),
    onSuccess: refresh,
  });
}
