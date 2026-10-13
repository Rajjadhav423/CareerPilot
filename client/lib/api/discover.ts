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
  /** Other sources listing the same job (duplicates merged into this one) */
  alsoOn?: string[];
};

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
  fetchedAt: string;
  sources: SourceStatus[];
};

export type DiscoverParams = {
  q?: string;
  location?: string;
  /** Only this kind of tech job; omit for all tech jobs. */
  role?: TechRole | null;
  limit?: number;
  /** Re-fetch the free sources now instead of using the cache. */
  refresh?: boolean;
};

/**
 * Find jobs is served by the Next.js route app/api/discover/jobs (same origin, Clerk session cookie): job sources
 * are fetched and cached there. The Spring API's /api/v1/discover/jobs still exists but isn't used by the app.
 */
export async function discoverJobs({ q = "", location = "", role, limit = 100, refresh = false }: DiscoverParams) {
  const params = new URLSearchParams({ q, location, limit: String(limit), refresh: String(refresh) });
  if (role) params.set("role", role);
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
