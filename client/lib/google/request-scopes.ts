import type { useUser } from "@clerk/nextjs";

type UserResource = NonNullable<ReturnType<typeof useUser>["user"]>;

/** Google permissions CareerPilot uses. Each is asked for only when the user turns that feature on. */
export const GOOGLE_SCOPES = {
  gmailSend: "https://www.googleapis.com/auth/gmail.send",
  driveFile: "https://www.googleapis.com/auth/drive.file",
} as const;

const KNOWN = new Set<string>(Object.values(GOOGLE_SCOPES));

/**
 * Sends the browser to Google (through Clerk) to grant `scopes`, then back to `redirectUrl`.
 * Re-authorizes the existing Google connection, or connects Google for users who signed up with a password.
 *
 * CareerPilot permissions the user already granted are requested again too, so turning on Drive never
 * drops Gmail sending (and vice versa). Clerk stores and refreshes the resulting Google tokens; the browser
 * never sees them.
 */
export async function requestGoogleScopes(user: UserResource, scopes: string[], redirectUrl: string) {
  const google = user.externalAccounts.find((account) => account.provider === "google");
  const alreadyGranted = (google?.approvedScopes ?? "").split(/\s+/).filter((scope) => KNOWN.has(scope));
  const additionalScopes = [...new Set([...scopes, ...alreadyGranted])];

  const account = google
    ? await google.reauthorize({ additionalScopes, redirectUrl })
    : await user.createExternalAccount({ strategy: "oauth_google", additionalScopes, redirectUrl });
  const next = account.verification?.externalVerificationRedirectURL;
  if (!next) throw new Error("Google didn't return a sign-in page. Try again in a moment.");
  window.location.assign(next.href);
}
