import type { DiscoverResponse, JobPosting, SourceStatus, TechRole } from "@/lib/api/discover";
import { classifyTechRole } from "./classify";
import { dedupe, type Classified } from "./dedupe";
import { parsePlaces } from "./places";
import { listSources, sourcePostings } from "./providers";

/*
 * Find jobs on the Next.js server: every source (each cached on its own), tech jobs only, duplicates merged,
 * newest first; then the user's search is applied to that in memory (like the backend's DiscoveryService).
 */

export const MAX_LIMIT = 500;

export type DiscoverQuery = {
  q: string;
  /** Free text, matched against the location (older clients) */
  location: string;
  /** Country display name, e.g. "India" */
  country: string | null;
  /** City in that country, e.g. "Bengaluru" */
  city: string | null;
  /** Remote jobs only */
  remote: boolean;
  /** Posted on or after (inclusive) / before (exclusive); jobs without a date are left out when set */
  from: Date | null;
  to: Date | null;
  role: TechRole | null;
  limit: number;
};

/** All tech postings from every ready source, merged. Reads only cached data unless a source has expired. */
export async function allJobs(): Promise<{ jobs: JobPosting[]; sources: SourceStatus[]; fetchedAt: string }> {
  const ready = listSources().filter((source) => source.missing.length === 0);
  const results = await Promise.allSettled(ready.map((source) => sourcePostings(source.key)));

  const classified: Classified[] = [];
  const sources: SourceStatus[] = [];
  let oldest: string | null = null;

  results.forEach((result, index) => {
    const source = ready[index];
    if (result.status === "rejected") {
      sources.push({ board: source.board, company: source.company, provider: source.provider, ok: false, count: 0,
        error: "Could not fetch this source right now." });
      return;
    }
    let count = 0;
    for (const raw of result.value.postings) {
      const techRole = classifyTechRole(raw.title, raw.department);
      if (!techRole) continue;
      const places = raw.places?.length ? raw.places : parsePlaces(raw.location);
      const remote = raw.workplaceType === "REMOTE" || places.some((p) => p.remote);
      classified.push({
        ...raw,
        places: remote && !places.some((p) => p.remote) ? [...places, { country: null, city: null, remote: true }] : places,
        workplaceType: remote ? "REMOTE" : raw.workplaceType,
        techRole,
        kind: source.kind,
      });
      count++;
    }
    sources.push({ board: source.board, company: source.company, provider: source.provider, ok: true, count, error: null });
    if (!oldest || result.value.fetchedAt < oldest) oldest = result.value.fetchedAt;
  });

  classified.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
  return { jobs: dedupe(classified), sources, fetchedAt: oldest ?? new Date().toISOString() };
}

const normalise = (value: string) => value.toLowerCase().trim();

function isRemote(job: JobPosting) {
  return job.workplaceType === "REMOTE" || job.places.some((p) => p.remote);
}

function matchesPosted(job: JobPosting, query: DiscoverQuery) {
  if (!query.from && !query.to) return true;
  if (!job.postedAt) return false;
  const posted = Date.parse(job.postedAt);
  return (!query.from || posted >= query.from.getTime()) && (!query.to || posted < query.to.getTime());
}

function matchesPlace(job: JobPosting, query: DiscoverQuery) {
  if (query.remote && !isRemote(job)) return false;
  if (query.country) {
    const inCountry = job.places.some((p) => p.country === query.country && (!query.city || p.city === query.city));
    if (!inCountry) return false;
  }
  const place = normalise(query.location);
  if (!place) return true;
  if (place === "remote") return isRemote(job);
  return normalise(job.location ?? "").includes(place);
}

/** Counts per name, most first. */
function tally(names: Iterable<string>) {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function search(all: Awaited<ReturnType<typeof allJobs>>, query: DiscoverQuery): DiscoverResponse {
  const terms = normalise(query.q).split(/\s+/).filter(Boolean);
  const textMatches = all.jobs.filter((job) => {
    const haystack = normalise(`${job.title} ${job.company} ${job.department ?? ""}`);
    return terms.every((term) => haystack.includes(term)) && matchesPosted(job, query);
  });

  // Role chips count jobs in the chosen place; country/city lists count jobs of the chosen role
  const placeMatches = textMatches.filter((job) => matchesPlace(job, query));
  const roleCounts: Partial<Record<TechRole, number>> = {};
  for (const job of placeMatches) roleCounts[job.techRole] = (roleCounts[job.techRole] ?? 0) + 1;

  const forFacets = textMatches.filter((job) => (!query.role || job.techRole === query.role) && (!query.remote || isRemote(job)));
  const countries = tally(forFacets.flatMap((job) => [...new Set(job.places.map((p) => p.country).filter((c): c is string => !!c))]));
  const cities = query.country
    ? tally(forFacets.flatMap((job) => [...new Set(job.places.filter((p) => p.country === query.country && p.city).map((p) => p.city as string))]))
    : [];

  const matches = query.role ? placeMatches.filter((job) => job.techRole === query.role) : placeMatches;
  const limit = Math.min(Math.max(query.limit, 1), MAX_LIMIT);
  return {
    jobs: matches.slice(0, limit),
    total: matches.length,
    roleCounts,
    facets: { countries, cities, remote: forFacets.filter(isRemote).length },
    fetchedAt: all.fetchedAt,
    sources: all.sources,
  };
}
