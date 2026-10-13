"use client";

import { UserButton, useAuth } from "@clerk/nextjs";

/**
 * Clerk's account menu (profile, security, sign out). Until Clerk has loaded, a same-sized placeholder is shown:
 * the server never has Clerk's client state, so rendering UserButton straight away made the server HTML and the
 * browser's first render differ (a hydration error).
 */
export function UserMenu() {
  const { isLoaded } = useAuth();
  return isLoaded ? <UserButton /> : <span aria-hidden className="size-7 rounded-full bg-neutral" />;
}
