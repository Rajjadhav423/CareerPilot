import { Suspense } from "react";
import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

import { AuthCardFallback } from "@/components/auth/auth-card-fallback";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  // Clerk reads the URL (multi-step flow), which needs a Suspense boundary with cacheComponents.
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <SignIn />
    </Suspense>
  );
}
