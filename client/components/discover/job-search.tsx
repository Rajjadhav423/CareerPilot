"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, RefreshCw, Search, SearchX } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

import { ApiError } from "@/lib/api/client";
import {
  discoverJobs,
  TECH_ROLES,
  type DiscoverParams,
  type DiscoverResponse,
  type TechRole,
} from "@/lib/api/discover";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { JobResults, roleLabel } from "./job-results";

const PAGE_SIZE = 100;

type Result = { data: DiscoverResponse; error: null } | { data: null; error: string };

async function load(params: DiscoverParams): Promise<Result> {
  try {
    return { data: await discoverJobs(params), error: null };
  } catch (error) {
    return { data: null, error: error instanceof ApiError ? error.message : "Unexpected error." };
  }
}

export function JobSearch() {
  const { isLoaded } = useAuth();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState<TechRole | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  // Ignore responses from older requests if the user searches again quickly.
  const latestRequest = useRef(0);

  useEffect(() => {
    // Wait for Clerk: before it loads there is no session token yet.
    if (!isLoaded) return;
    load({ limit: PAGE_SIZE }).then((next) => {
      if (latestRequest.current === 0) {
        setResult(next);
        setLoading(false);
      }
    });
  }, [isLoaded]);

  function run(params: DiscoverParams) {
    const requestId = ++latestRequest.current;
    setLoading(true);
    load(params).then((next) => {
      if (requestId !== latestRequest.current) return;
      setResult(next);
      setLoading(false);
    });
  }

  function search(event: React.FormEvent) {
    event.preventDefault();
    setLimit(PAGE_SIZE);
    run({ q: query, location, role, limit: PAGE_SIZE });
  }

  function selectRole(next: TechRole | null) {
    setRole(next);
    setLimit(PAGE_SIZE);
    run({ q: query, location, role: next, limit: PAGE_SIZE });
  }

  const data = result?.data ?? null;
  const failedSources = data?.sources.filter((s) => !s.ok) ?? [];
  const okBoards = data ? data.sources.length - failedSources.length : 0;
  const allTechCount = data ? Object.values(data.roleCounts).reduce((sum, n) => sum + (n ?? 0), 0) : 0;

  return (
    // @container: layout follows the content area's width (sidebar open/closed), not the screen's.
    <div className="@container flex flex-col gap-4">
      <form onSubmit={search} className="flex flex-col gap-2 @2xl:flex-row">
        <TextField
          className="@2xl:flex-1"
          elemBefore={<Search />}
          placeholder="Job title, skill or company (e.g. backend engineer)"
          aria-label="Job title, skill or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <TextField
          className="@2xl:w-64"
          elemBefore={<MapPin />}
          placeholder="Location (e.g. Bengaluru, Remote)"
          aria-label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Button type="submit" variant="primary" isLoading={loading && !!data}>
          Search
        </Button>
      </form>

      {data && (
        // Narrow: one row you swipe sideways. Wide: wraps onto several lines.
        <div
          role="group"
          aria-label="Filter by role"
          className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] @2xl:flex-wrap @2xl:overflow-visible @2xl:pb-0 [&>button]:shrink-0"
        >
          <Button size="compact" isSelected={role === null} onClick={() => selectRole(null)}>
            All tech <span className="text-subtlest">{formatNumber(allTechCount)}</span>
          </Button>
          {TECH_ROLES.map(({ id, label }) => {
            const count = data.roleCounts[id] ?? 0;
            if (count === 0 && role !== id) return null;
            return (
              <Button key={id} size="compact" isSelected={role === id} onClick={() => selectRole(id)}>
                {label} <span className="text-subtlest">{formatNumber(count)}</span>
              </Button>
            );
          })}
        </div>
      )}

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-subtle">
          <p>
            Showing <strong className="text-foreground">{formatNumber(data.jobs.length)}</strong> of{" "}
            <strong className="text-foreground">{formatNumber(data.total)}</strong>{" "}
            {role ? roleLabel[role].toLowerCase() : "tech"} jobs from {okBoards} company boards · updated{" "}
            {formatRelativeTime(data.fetchedAt)}
          </p>
          <Button
            variant="subtle"
            size="compact"
            disabled={loading}
            onClick={() => run({ q: query, location, role, limit, refresh: true })}
          >
            <RefreshCw /> Refresh boards
          </Button>
        </div>
      )}

      {failedSources.length > 0 && (
        <SectionMessage appearance="warning" title="Some boards couldn't be loaded">
          {failedSources.map((s) => s.board).join(", ")}. Results from the other boards are shown.
        </SectionMessage>
      )}

      {!data && loading && (
        <div className="flex items-center gap-2 py-10 text-subtle">
          <Spinner /> Fetching live openings from company job boards… (first load takes a few seconds)
        </div>
      )}

      {result?.error && (
        <SectionMessage appearance="error" title="Couldn't load jobs">
          {result.error}
        </SectionMessage>
      )}

      {data && data.jobs.length === 0 && (
        <EmptyState
          icon={<SearchX />}
          title="No jobs match your search"
          description="Try fewer words, a different location, or clear the filters."
        />
      )}

      {data && data.jobs.length > 0 && (
        <div className={loading ? "opacity-60 transition-opacity" : undefined}>
          <JobResults jobs={data.jobs} />

          {data.jobs.length < data.total && (
            <div className="flex justify-center pt-4">
              <Button
                disabled={loading}
                onClick={() => {
                  const next = limit + PAGE_SIZE;
                  setLimit(next);
                  run({ q: query, location, role, limit: next });
                }}
              >
                Show more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
