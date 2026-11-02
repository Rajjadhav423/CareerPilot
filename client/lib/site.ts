/** Public-facing site details, used by the home page, legal pages and metadata. */
export const SITE = {
  name: "CareerPilot",
  tagline: "Your job search, on autopilot.",
  description:
    "CareerPilot finds live tech openings, matches them to your resume, helps you email HR from your Gmail and reminds you to follow up, with you in control.",
  /** Shown on the privacy/terms pages. Set before launching publicly. */
  contactEmail: null as string | null,
  legalLastUpdated: "11 October 2026",
} as const;
