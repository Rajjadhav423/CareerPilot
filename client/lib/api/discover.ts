import { apiFetch } from "./client";

/** Mirrors the backend's discovery WorkplaceType */
export type WorkplaceType = "ONSITE" | "HYBRID" | "REMOTE" | "UNSPECIFIED";

/** Mirrors the backend's discovery TechRole */
export type TechRole =
  | "BACKEND"
  | "FRONTEND"
  | "FULL_STACK"
  | "MOBILE"
  | "DEVOPS"
  | "DATA_ML"
  | "QA"
  | "SECURITY"
  | "GENERAL";

/** Display order and labels for role filters. Backend first: it's the main focus. */
export const TECH_ROLES: { id: TechRole; label: string }[] = [
  { id: "BACKEND", label: "Backend" },
  { id: "FULL_STACK", label: "Full-stack" },
  { id: "FRONTEND", label: "Frontend" },
  { id: "MOBILE", label: "Mobile" },
  { id: "DEVOPS", label: "DevOps / SRE" },
  { id: "DATA_ML", label: "Data / ML" },
  { id: "SECURITY", label: "Security" },
  { id: "QA", label: "QA" },
  { id: "GENERAL", label: "General" },
];

/** Mirrors the backend's discovery JobPosting */
export type JobPosting = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  department: string | null;
  workplaceType: WorkplaceType;
  url: string;
  postedAt: string | null;
  source: string;
  techRole: TechRole;
  /** Hiring email the company published in the post (e.g. Hacker News "Who is hiring?") */
  contactEmail?: string;
  /** Other sources listing the same job (duplicates merged into this one) */
  alsoOn?: string[];
  /** Where the job is: country/city from the source, or read from `location`; remote = can be done remotely */
  places: { country: string | null; city: string | null; remote: boolean }[];
};

export type Facet = { name: string; count: number };

export type SourceStatus = {
  board: string;
  company: string;
  provider: string;
  ok: boolean;
  count: number;
  error: string | null;
};

/** Mirrors the backend's discovery DiscoverResponse */
export type DiscoverResponse = {
  jobs: JobPosting[];
  total: number;
  /** Matches per role for the current query/location, ignoring the role filter. */
  roleCounts: Partial<Record<TechRole, number>>;
  /** Countries (and cities of the chosen country) with job counts, for the location filters */
  /** withEmail: matches (ignoring the email filter) whose post gives a hiring email */
  facets: { countries: Facet[]; cities: Facet[]; remote: number; withEmail: number };
  fetchedAt: string;
  sources: SourceStatus[];
};

/** Countries shown first in the filter (the app's focus), then every other country found. */
export const FEATURED_COUNTRIES = ["India", "Japan", "Germany"];

export type PostedPreset = "24h" | "3d" | "7d" | "30d";

export const POSTED_PRESETS: { id: PostedPreset; label: string }[] = [
  { id: "24h", label: "Past 24 hours" },
  { id: "3d", label: "Past 3 days" },
  { id: "7d", label: "Past week" },
  { id: "30d", label: "Past month" },
];

export type DiscoverParams = {
  q?: string;
  location?: string;
  /** Only this kind of tech job; omit for all tech jobs. */
  role?: TechRole | null;
  /** Country name from facets, e.g. "India" */
  country?: string | null;
  /** City in that country */
  city?: string | null;
  /** Remote jobs only */
  remote?: boolean;
  /** Posted within the last 24 hours, 3 days, 7 days or 30 days */
  posted?: PostedPreset | null;
  /** Custom range, YYYY-MM-DD (both days included); used when `posted` is not set */
  from?: string | null;
  to?: string | null;
  limit?: number;
  /** Only jobs whose post gives a hiring email */
  hasEmail?: boolean;
  /** Re-fetch the sources now instead of using the cache. */
  refresh?: boolean;
};

/** Job sources are fetched and cached by the backend and shared by all users; the search runs on that cache. */
export async function discoverJobs({
  q = "", location = "", role, country, city, remote = false, posted, from, to, hasEmail = false, limit = 100, refresh = false,
}: DiscoverParams, token: string | null) {
  const params = new URLSearchParams({ q, location, limit: String(limit), refresh: String(refresh) });
  if (role) params.set("role", role);
  if (country) params.set("country", country);
  if (country && city) params.set("city", city);
  if (remote) params.set("remote", "true");
  if (hasEmail) params.set("hasEmail", "true");
  if (posted) params.set("posted", posted);
  else {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  return apiFetch<DiscoverResponse>(`/api/v1/discover/jobs?${params}`, { token, cache: "no-store" });
}
