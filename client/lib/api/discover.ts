import { ApiError } from "./client";

/** Mirrors com.careerpilot.backend.discovery.WorkplaceType */
export type WorkplaceType = "ONSITE" | "HYBRID" | "REMOTE" | "UNSPECIFIED";

/** Mirrors com.careerpilot.backend.discovery.TechRole */
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

/** Mirrors com.careerpilot.backend.discovery.JobPosting */
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

/** Mirrors com.careerpilot.backend.discovery.DiscoverResponse */
export type DiscoverResponse = {
  jobs: JobPosting[];
  total: number;
  /** Matches per role for the current query/location, ignoring the role filter. */
  roleCounts: Partial<Record<TechRole, number>>;
  /** Countries (and cities of the chosen country) with job counts, for the location filters */
  facets: { countries: Facet[]; cities: Facet[]; remote: number };
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
  /** Re-fetch the free sources now instead of using the cache. */
  refresh?: boolean;
};

/**
 * Find jobs is served by the Next.js route app/api/discover/jobs (same origin, Clerk session cookie): job sources
 * are fetched and cached there. The Spring API's /api/v1/discover/jobs still exists but isn't used by the app.
 */
export async function discoverJobs({
  q = "", location = "", role, country, city, remote = false, posted, from, to, limit = 100, refresh = false,
}: DiscoverParams) {
  const params = new URLSearchParams({ q, location, limit: String(limit), refresh: String(refresh) });
  if (role) params.set("role", role);
  if (country) params.set("country", country);
  if (country && city) params.set("city", city);
  if (remote) params.set("remote", "true");
  if (posted) params.set("posted", posted);
  else {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  let response: Response;
  try {
    response = await fetch(`/api/discover/jobs?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  } catch {
    throw new ApiError("Couldn't reach CareerPilot. Check your connection.", 0);
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string; code?: string };
    throw new ApiError(problem.detail ?? `Request failed with status ${response.status}.`, response.status, problem.code);
  }
  return (await response.json()) as DiscoverResponse;
}
