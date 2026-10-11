/** Public-facing site details, used by the home page, legal pages and metadata. */
export const SITE = {
  name: "CareerPilot",
  tagline: "Your job search, organised.",
  description:
    "CareerPilot finds tech openings from company career pages, keeps every application on one board, and helps you prepare, with you in control.",
  /** Shown on the privacy/terms pages. Set before launching publicly. */
  contactEmail: null as string | null,
  legalLastUpdated: "11 October 2026",
} as const;
