"use client";

import { SignOutButton as ClerkSignOut } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Ends the session and returns to sign-in (Clerk). */
export function SignOutButton() {
  return (
    <ClerkSignOut>
      <Button variant="default">
        <LogOut /> Sign out
      </Button>
    </ClerkSignOut>
  );
}
