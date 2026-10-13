import type { DiscoverResponse, JobPosting, SourceStatus, TechRole } from "@/lib/api/discover";
import { classifyTechRole } from "./classify";
import { dedupe, type Classified } from "./dedupe";
import { fetchSource, listSources } from "./providers";

/*
 * Find jobs on the Next.js server: every source (each cached on its own), tech jobs only, duplicates merged,
 * newest first; then the user's search is applied to that in memory (like the backend's DiscoveryService).
 */

export const MAX_LIMIT = 500;

export type DiscoverQuery = { q: string; location: string; role: TechRole | null; limit: number };

/** All tech postings from every ready source, merged. Reads only cached data unless a source has expired. */
export async function allJobs(): Promise<{ jobs: JobPosting[]; sources: SourceStatus[]; fetchedAt: string }> {
  const ready = listSources().filter((source) => source.missing.length === 0);
  const results = await Promise.allSettled(ready.map((source) => fetchSource(source.key)));

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
    for (const posting of result.value.postings) {
      const techRole = classifyTechRole(posting.title, posting.department);
      if (!techRole) continue;
      classified.push({ ...posting, techRole, kind: source.kind });
      count++;
    }
    sources.push({ board: source.board, company: source.company, provider: source.provider, ok: true, count, error: null });
    if (!oldest || result.value.fetchedAt < oldest) oldest = result.value.fetchedAt;
  });

  classified.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
  return { jobs: dedupe(classified), sources, fetchedAt: oldest ?? new Date().toISOString() };
}

const normalise = (value: string) => value.toLowerCase().trim();

export function search(all: Awaited<ReturnType<typeof allJobs>>, query: DiscoverQuery): DiscoverResponse {
  const terms = normalise(query.q).split(/\s+/).filter(Boolean);
  const place = normalise(query.location);

  const queryMatches = all.jobs.filter((job) => {
    const haystack = normalise(`${job.title} ${job.company} ${job.department ?? ""}`);
    if (!terms.every((term) => haystack.includes(term))) return false;
    if (!place) return true;
    if (place === "remote" && job.workplaceType === "REMOTE") return true;
    return normalise(job.location ?? "").includes(place);
  });

  const roleCounts: Partial<Record<TechRole, number>> = {};
  for (const job of queryMatches) roleCounts[job.techRole] = (roleCounts[job.techRole] ?? 0) + 1;

  const matches = query.role ? queryMatches.filter((job) => job.techRole === query.role) : queryMatches;
  const limit = Math.min(Math.max(query.limit, 1), MAX_LIMIT);
  return {
    jobs: matches.slice(0, limit),
    total: matches.length,
    roleCounts,
    fetchedAt: all.fetchedAt,
    sources: all.sources,
  };
}
