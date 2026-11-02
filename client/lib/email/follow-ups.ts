"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { listFollowUps } from "@/lib/api/application-emails";

/** No reply this long after an email: time to follow up (the backend's rule, for labels) */
export const FOLLOW_UP_AFTER_DAYS = 7;

/** Applications waiting on the user. Under "emails", so sending an email refreshes it. */
export function useFollowUps() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["emails", "follow-ups"],
    queryFn: async () => listFollowUps(await getToken()),
    enabled: isLoaded && !!isSignedIn,
  });
}
