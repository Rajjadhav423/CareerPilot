"use client";

import { UserProfile, useAuth } from "@clerk/nextjs";

import { Spinner } from "@/components/ui/spinner";

/**
 * The account, managed by Clerk: name, photo, email addresses and the connected Google account.
 * Styled with the app's tokens (lib/clerk-appearance.ts via ClerkProvider) and stretched to the page width.
 * Rendered after Clerk loads, like the user menu, so server and browser HTML match.
 */
export function AccountProfile() {
  const { isLoaded } = useAuth();
  if (!isLoaded) {
    return <div className="flex items-center gap-2 py-10 text-subtle"><Spinner /> Loading your profile…</div>;
  }
  return (
    <UserProfile
      routing="hash"
      appearance={{
        elements: {
          rootBox: "w-full",
          cardBox: "w-full max-w-none rounded-lg border border-border shadow-raised",
          // Only the profile page is shown: no Security tab, so no side menu (desktop or mobile) is needed
          navbar: "hidden",
          navbarMobileMenuRow: "hidden",
          navbarButton__security: "hidden",
          // The photo comes from the sign-in account; uploading or removing it here isn't offered
          avatarImageActions: "hidden",
          avatarImageActionsUpload: "hidden",
          avatarImageActionsRemove: "hidden",
        },
      }}
    />
  );
}
