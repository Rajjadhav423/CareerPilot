import { apiFetch } from "./client";

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
  /** Ignore the server's 15-minute cache and fetch every board again. */
  refresh?: boolean;
};

export function discoverJobs(
  { q = "", location = "", role, limit = 100, refresh = false }: DiscoverParams,
  token: string | null,
) {
  const params = new URLSearchParams({ q, location, limit: String(limit), refresh: String(refresh) });
  if (role) params.set("role", role);
  return apiFetch<DiscoverResponse>(`/api/v1/discover/jobs?${params}`, { token });
}
