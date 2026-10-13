import { auth } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { TECH_ROLES, type TechRole } from "@/lib/api/discover";
import { allJobs, search } from "@/lib/discover/server/discover";
import { FREE_SOURCES_TAG } from "@/lib/discover/server/providers";

/**
 * GET /api/discover/jobs?q=java&location=bengaluru&role=BACKEND&limit=100&refresh=false
 *
 * Find jobs runs here (Next.js on Vercel) instead of the Spring API: job sources are fetched server-side,
 * cached per source and shared by all users. Same response shape as the backend's /api/v1/discover/jobs.
 * Signed-in users only.
 */

// Sources are fetched in parallel with a 10 s timeout each
export const maxDuration = 30;

/** "Refresh" re-fetches the free sources at most once a minute per server instance (keyed sources never). */
let lastRefresh = 0;

const ROLES = new Set<string>(TECH_ROLES.map((role) => role.id));

function problem(status: number, code: string, detail: string) {
  return Response.json({ status, code, detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return problem(401, "UNAUTHENTICATED", "Please sign in again.");

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").slice(0, 200);
  const location = (params.get("location") ?? "").slice(0, 100);
  const roleParam = params.get("role");
  if (roleParam && !ROLES.has(roleParam)) return problem(400, "INVALID_ROLE", "Unknown job role.");
  const limit = Number.parseInt(params.get("limit") ?? "100", 10);

  if (params.get("refresh") === "true" && Date.now() - lastRefresh > 60_000) {
    lastRefresh = Date.now();
    revalidateTag(FREE_SOURCES_TAG, { expire: 0 });
  }

  const result = search(await allJobs(), {
    q,
    location,
    role: (roleParam as TechRole | null) || null,
    limit: Number.isFinite(limit) ? limit : 100,
  });
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

