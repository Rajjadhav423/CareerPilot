import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { clerkAppearance } from "@/lib/clerk-appearance";
import { ROUTES } from "@/lib/routes";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CareerPilot",
    template: "%s · CareerPilot",
  },
  description: "Personal AI job search and application manager",
};

/**
 * Root: fonts, theme and Clerk.
 * app/(marketing): public pages · app/(auth): sign-in/up · app/(app): the signed-in app under /dashboard
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by themeInitScript before paint, so React must ignore the mismatch.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl={ROUTES.signIn}
          signUpUrl={ROUTES.signUp}
          // Where to go after signing in/up when no specific page was requested
          signInFallbackRedirectUrl={ROUTES.dashboard}
          signUpFallbackRedirectUrl={ROUTES.dashboard}
          afterSignOutUrl={ROUTES.home}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
