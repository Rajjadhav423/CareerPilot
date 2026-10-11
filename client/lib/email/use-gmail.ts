"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";

import { getGmailStatus } from "@/lib/api/gmail";

/** The only Google permission CareerPilot asks for: send email as the user (it can't read the inbox). */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export const GMAIL_STATUS_KEY = ["gmail-status"] as const;

/** Whether the user's Google account can send email. Comes from the server; no tokens reach the browser. */
export function useGmailStatus() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: GMAIL_STATUS_KEY,
    queryFn: async () => getGmailStatus(await getToken()),
    enabled: isLoaded && !!isSignedIn,
  });
}

/**
 * Sends the user to Google (through Clerk) to grant the gmail.send permission, then back to this page.
 * Re-authorizes an existing Google connection, or connects Google if the user signed up with a password.
 * Clerk stores the resulting tokens; the CareerPilot server asks Clerk for them only when sending.
 */
export function useConnectGmail() {
  const { user } = useUser();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You're not signed in.");
      const redirectUrl = window.location.href;
      const google = user.externalAccounts.find((account) => account.provider === "google");
      const account = google
        ? await google.reauthorize({ additionalScopes: [GMAIL_SEND_SCOPE], redirectUrl })
        : await user.createExternalAccount({
            strategy: "oauth_google",
            additionalScopes: [GMAIL_SEND_SCOPE],
            redirectUrl,
          });
      const next = account.verification?.externalVerificationRedirectURL;
      if (!next) throw new Error("Google didn't return a sign-in page. Try again in a moment.");
      window.location.assign(next.href);
    },
  });
}
