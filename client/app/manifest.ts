import type { MetadataRoute } from "next";

import { ROUTES } from "@/lib/routes";
import { SITE } from "@/lib/site";

/**
 * Web app manifest: lets phones and desktops install CareerPilot as an app (home-screen icon, own window).
 * Served at /manifest.webmanifest; Next.js adds the <link rel="manifest"> tag.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: ROUTES.dashboard,
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    // Installed app opens straight into the signed-in area (signed-out users are sent to sign-in)
    start_url: ROUTES.dashboard,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon (Android, desktop) to jump straight to these pages
    shortcuts: [
      { name: "Job board", url: ROUTES.jobs, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Find jobs", url: ROUTES.discover, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Email templates", url: ROUTES.templates, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
