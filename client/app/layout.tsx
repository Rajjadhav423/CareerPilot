import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { clerkAppearance } from "@/lib/clerk-appearance";
import { ROUTES } from "@/lib/routes";
import { SITE } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
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
  applicationName: SITE.name,
  // iPhone/iPad "Add to Home Screen": open full screen like an app, with this name under the icon
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
};

/** Browser and installed-app chrome colour: the --surface token of each theme (app/globals.css). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1f21" },
  ],
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
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
