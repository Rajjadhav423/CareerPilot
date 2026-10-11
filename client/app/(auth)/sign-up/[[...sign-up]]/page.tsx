import { Suspense } from "react";
import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

import { AuthCardFallback } from "@/components/auth/auth-card-fallback";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignUpPage() {
  // Clerk reads the URL (multi-step flow), which needs a Suspense boundary with cacheComponents.
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <SignUp />
    </Suspense>
  );
}
