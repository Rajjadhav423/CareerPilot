"use client";

import { RedirectToSignIn, Show } from "@clerk/nextjs";

import { Spinner } from "@/components/ui/spinner";

/**
 * Sends signed-out visitors to /sign-in (and back afterwards), hiding the page behind an overlay meanwhile.
 *
 * The page itself always renders, so Next.js can prerender it for instant navigation (cacheComponents).
 * That's safe because pages hold no private data: everything personal comes from the Spring API, which
 * checks the Clerk token on every request. Components that call the API wait for Clerk to load first.
 */
export function SignedInOnly({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Show when="signed-out">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface text-subtle">
          <Spinner size="lg" label="Redirecting to sign in" />
        </div>
        <RedirectToSignIn />
      </Show>
    </>
  );
}
