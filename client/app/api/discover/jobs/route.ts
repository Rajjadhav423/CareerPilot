import { auth } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { TECH_ROLES, type TechRole } from "@/lib/api/discover";
import { allJobs, search } from "@/lib/discover/server/discover";
import { FREE_SOURCES_TAG, forgetFreeSources } from "@/lib/discover/server/providers";

/**
 * GET /api/discover/jobs?q=java&country=India&city=Bengaluru&remote=false&role=BACKEND&limit=100&refresh=false
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

const PRESET_HOURS: Record<string, number> = { "24h": 24, "3d": 72, "7d": 168, "30d": 720 };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * posted=24h|3d|7d|30d, or from/to as YYYY-MM-DD (UTC days, both inclusive). Returns the time window.
 */
function postedRange(params: URLSearchParams): { from: Date | null; to: Date | null } | { error: string } {
  const preset = params.get("posted");
  if (preset) {
    const hours = PRESET_HOURS[preset];
    if (!hours) return { error: "posted must be 24h, 3d, 7d or 30d." };
    return { from: new Date(Date.now() - hours * 3_600_000), to: null };
  }
  const fromText = params.get("from") ?? "";
  const toText = params.get("to") ?? "";
  if ((fromText && !DAY.test(fromText)) || (toText && !DAY.test(toText))) return { error: "Dates must be YYYY-MM-DD." };
  const from = fromText ? new Date(`${fromText}T00:00:00Z`) : null;
  // "to" includes that whole day
  const to = toText ? new Date(Date.parse(`${toText}T00:00:00Z`) + 86_400_000) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return { error: "That date doesn't exist." };
  if (from && to && from >= to) return { error: "The start date must be on or before the end date." };
  return { from, to };
}

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
  const country = (params.get("country") ?? "").trim().slice(0, 60) || null;
  const city = country ? (params.get("city") ?? "").trim().slice(0, 80) || null : null;
  const remote = params.get("remote") === "true";
  const range = postedRange(params);
  if ("error" in range) return problem(400, "INVALID_DATE", range.error);

  if (params.get("refresh") === "true" && Date.now() - lastRefresh > 60_000) {
    lastRefresh = Date.now();
    revalidateTag(FREE_SOURCES_TAG, { expire: 0 });
    forgetFreeSources();
  }

  const result = search(await allJobs(), {
    q,
    location,
    country,
    city,
    remote,
    from: range.from,
    to: range.to,
    role: (roleParam as TechRole | null) || null,
    limit: Number.isFinite(limit) ? limit : 100,
  });
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

