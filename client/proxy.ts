import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next 16 "proxy" (formerly middleware). Clerk needs it to manage the session on every request.
 * It deliberately makes no auth decisions (Clerk's recommended "resource-based" approach):
 * - pages: components/auth/signed-in-only.tsx sends signed-out visitors to /sign-in
 * - data: the Spring API verifies the Clerk token on every request
 */
export default clerkMiddleware({
  // Our own themed pages, not Clerk's hosted Account Portal.
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
