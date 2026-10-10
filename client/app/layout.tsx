import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { themeInitScript } from "@/lib/theme";
import { AppShell } from "@/components/layout/app-shell";
import { SideNav } from "@/components/layout/side-nav";
import { TopNav } from "@/components/layout/top-nav";
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
        <AppShell header={<TopNav />} sidebar={<SideNav />}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
