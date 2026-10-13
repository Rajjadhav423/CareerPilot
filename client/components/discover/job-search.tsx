"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Search, SearchX } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

import { ApiError } from "@/lib/api/client";
import {
  discoverJobs,
  FEATURED_COUNTRIES,
  POSTED_PRESETS,
  TECH_ROLES,
  type DiscoverParams,
  type DiscoverResponse,
  type PostedPreset,
  type TechRole,
} from "@/lib/api/discover";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { JobResults, roleLabel } from "./job-results";

const PAGE_SIZE = 100;

/** "Where" select values besides country names */
const ANYWHERE = "";
const REMOTE = "__remote__";

/** "Posted" select values besides the presets */
const ANY_TIME = "";
const CUSTOM = "custom";

/** Today as YYYY-MM-DD (local), the latest date the range pickers allow. */
function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

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
  // Where: Anywhere, Remote or a country; city only within a country
  const [where, setWhere] = useState(ANYWHERE);
  const [city, setCity] = useState("");
  // Posted: any time, a preset (24h, 3d, 7d, 30d) or a custom from/to range
  const [posted, setPosted] = useState(ANY_TIME);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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

  /** Current filters as request parameters */
  function params(overrides: Partial<{
    role: TechRole | null; where: string; city: string; posted: string; from: string; to: string; limit: number; refresh: boolean;
  }> = {}): DiscoverParams {
    const w = overrides.where ?? where;
    const c = overrides.city ?? city;
    const p = overrides.posted ?? posted;
    const custom = p === CUSTOM;
    return {
      q: query,
      role: overrides.role !== undefined ? overrides.role : role,
      remote: w === REMOTE,
      country: w !== REMOTE && w !== ANYWHERE ? w : null,
      city: w !== REMOTE && w !== ANYWHERE && c ? c : null,
      posted: p && !custom ? (p as PostedPreset) : null,
      from: custom ? (overrides.from ?? from) || null : null,
      to: custom ? (overrides.to ?? to) || null : null,
      limit: overrides.limit ?? PAGE_SIZE,
      refresh: overrides.refresh ?? false,
    };
  }

  function search(event: React.FormEvent) {
    event.preventDefault();
    setLimit(PAGE_SIZE);
    run(params());
  }

  function selectRole(next: TechRole | null) {
    setRole(next);
    setLimit(PAGE_SIZE);
    run(params({ role: next }));
  }

  function selectWhere(next: string) {
    setWhere(next);
    setCity("");
    setLimit(PAGE_SIZE);
    run(params({ where: next, city: "" }));
  }

  function selectCity(next: string) {
    setCity(next);
    setLimit(PAGE_SIZE);
    run(params({ city: next }));
  }

  function selectPosted(next: string) {
    setPosted(next);
    setLimit(PAGE_SIZE);
    run(params({ posted: next }));
  }

  /** Custom range: searches when a date changes and the range is complete or open-ended and valid. */
  function selectRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo && nextFrom > nextTo) return;
    setLimit(PAGE_SIZE);
    run(params({ from: nextFrom, to: nextTo }));
  }

  const rangeInvalid = posted === CUSTOM && !!from && !!to && from > to;

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
        <Button type="submit" variant="primary" isLoading={loading && !!data}>
          Search
        </Button>
      </form>

      {data && (
        <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2 @3xl:max-w-4xl @3xl:grid-cols-3">
          <Select aria-label="Where" value={where} onChange={(e) => selectWhere(e.target.value)}>
            <option value={ANYWHERE}>Anywhere</option>
            <option value={REMOTE}>Remote ({formatNumber(data.facets.remote)})</option>
            <optgroup label="Countries">
              {FEATURED_COUNTRIES.map((name) => (
                <option key={name} value={name}>
                  {name} ({formatNumber(data.facets.countries.find((c) => c.name === name)?.count ?? 0)})
                </option>
              ))}
            </optgroup>
            <optgroup label="Other countries">
              {data.facets.countries.filter((c) => !FEATURED_COUNTRIES.includes(c.name)).map((c) => (
                <option key={c.name} value={c.name}>{c.name} ({formatNumber(c.count)})</option>
              ))}
              {where !== ANYWHERE && where !== REMOTE && !FEATURED_COUNTRIES.includes(where)
                && !data.facets.countries.some((c) => c.name === where) && <option value={where}>{where} (0)</option>}
            </optgroup>
          </Select>
          <Select aria-label="City" value={city} onChange={(e) => selectCity(e.target.value)}
            disabled={where === ANYWHERE || where === REMOTE}>
            <option value="">{where === ANYWHERE || where === REMOTE ? "Choose a country for cities" : `All cities in ${where}`}</option>
            {data.facets.cities.map((c) => (
              <option key={c.name} value={c.name}>{c.name} ({formatNumber(c.count)})</option>
            ))}
            {city && !data.facets.cities.some((c) => c.name === city) && <option value={city}>{city} (0)</option>}
          </Select>
          <Select aria-label="Posted" value={posted} onChange={(e) => selectPosted(e.target.value)}>
            <option value={ANY_TIME}>Posted any time</option>
            {POSTED_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
            <option value={CUSTOM}>Custom range…</option>
          </Select>
        </div>
      )}

      {data && posted === CUSTOM && (
        <div className="grid grid-cols-2 gap-2 @3xl:max-w-md">
          <Field htmlFor="posted-from" label="From" error={rangeInvalid ? "Must be before To" : undefined}>
            <DatePicker id="posted-from" value={from} max={to || today()} placeholder="Any date"
              onChange={(next) => selectRange(next, to)} aria-invalid={rangeInvalid}
              aria-describedby={rangeInvalid ? "posted-from-error" : undefined} />
          </Field>
          <Field htmlFor="posted-to" label="To" hint="Both days included">
            <DatePicker id="posted-to" value={to} min={from || undefined} max={today()} placeholder="Today"
              onChange={(next) => selectRange(from, next)} />
          </Field>
        </div>
      )}

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
          {loading ? (
            <p className="flex items-center gap-2"><Spinner size="sm" /> Updating results…</p>
          ) : (
          <p>
            Showing <strong className="text-foreground">{formatNumber(data.jobs.length)}</strong> of{" "}
            <strong className="text-foreground">{formatNumber(data.total)}</strong>{" "}
            {role ? roleLabel[role].toLowerCase() : "tech"} jobs{where === REMOTE ? " (remote)" : where ? ` in ${city || where}` : ""}
            {posted && posted !== CUSTOM ? ` · ${POSTED_PRESETS.find((p) => p.id === posted)?.label.toLowerCase()}` : ""}
            {posted === CUSTOM && (from || to) ? ` · ${from || "…"} to ${to || "today"}` : ""} from{" "}
            {okBoards} sources · updated{" "}
            {formatRelativeTime(data.fetchedAt)}
          </p>
          )}
          <Button
            variant="subtle"
            size="compact"
            disabled={loading}
            onClick={() => run(params({ limit, refresh: true }))}
          >
            <RefreshCw /> Refresh
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
          <Spinner /> Fetching live openings from job boards… (first load takes a few seconds)
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
          description="Try fewer words, another country, city or date range, or clear the filters. Jobs without a posting date are hidden while a date filter is on."
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
                  run(params({ limit: next }));
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
