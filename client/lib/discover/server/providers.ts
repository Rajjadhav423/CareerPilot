import { cacheLife, cacheTag } from "next/cache";

import type { WorkplaceType } from "@/lib/api/discover";
import { cityName, countryName, type Place } from "./places";

/*
 * Job sources for Find jobs, fetched on the server (Next.js on Vercel), never from the browser: API keys stay
 * secret and every user shares the same cached results. Each source is cached separately ('use cache: remote',
 * shared across server instances) with a lifetime that respects its free-tier limits, so users searching never
 * cause extra calls. Sources that need an API key are skipped until the key is set in the environment.
 *
 * Only fixed hosts are called; user input never goes into these requests (search happens on the cached data).
 */

/** A posting before tech-role classification. Descriptions are not kept: small, fast cache entries. */
export type RawPosting = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  department: string | null;
  workplaceType: WorkplaceType;
  url: string;
  postedAt: string | null;
  source: string;
  /** Structured country/city from the source; otherwise derived from `location` later */
  places?: Place[];
  /** A hiring contact the company published in the post itself (e.g. Hacker News "Who is hiring?") */
  contactEmail?: string;
};

export type SourceResult = { postings: RawPosting[]; fetchedAt: string };

/** "company": a company's own job board (direct apply link); "feed": a job board; "aggregator": a search engine. */
export type SourceKind = "company" | "feed" | "aggregator";

export type Source = {
  key: string;
  /** Provider name shown to users, e.g. "Greenhouse", "Adzuna" */
  provider: string;
  /** Board label, e.g. "greenhouse:stripe" or "adzuna" */
  board: string;
  company: string;
  kind: SourceKind;
  /** Missing API keys (empty = ready) */
  missing: string[];
};

type BoardProvider = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "recruitee";

/**
 * Public company job boards (no API key). The first group matches the backend (careerpilot.discovery.boards);
 * the rest add companies hiring in India, Japan and Germany, and global remote-friendly companies.
 * Every slug was checked to return jobs. To add one: provider, the company's board id, display name.
 */
const COMPANY_BOARDS: [provider: BoardProvider, slug: string, company: string][] = [
  ["greenhouse", "groww", "Groww"],
  ["greenhouse", "druva", "Druva"],
  ["greenhouse", "hackerrank", "HackerRank"],
  ["greenhouse", "stripe", "Stripe"],
  ["greenhouse", "databricks", "Databricks"],
  ["greenhouse", "cloudflare", "Cloudflare"],
  ["lever", "cred", "CRED"],
  ["lever", "meesho", "Meesho"],
  ["lever", "zeta", "Zeta"],
  ["lever", "paytm", "Paytm"],
  ["ashby", "sarvam", "Sarvam AI"],
  ["ashby", "notion", "Notion"],
  ["ashby", "openai", "OpenAI"],
  // India
  ["greenhouse", "razorpaysoftwareprivatelimited", "Razorpay"],
  ["lever", "fampay", "FamPay"],
  ["lever", "mindtickle", "Mindtickle"],
  ["smartrecruiters", "Freshworks", "Freshworks"],
  // Japan
  ["greenhouse", "paypay", "PayPay"],
  // Germany
  ["greenhouse", "n26", "N26"],
  ["greenhouse", "celonis", "Celonis"],
  ["greenhouse", "getyourguide", "GetYourGuide"],
  ["greenhouse", "contentful", "Contentful"],
  ["greenhouse", "traderepublicbank", "Trade Republic"],
  ["greenhouse", "hellofresh", "HelloFresh"],
  ["greenhouse", "sumup", "SumUp"],
  ["smartrecruiters", "DeliveryHero", "Delivery Hero"],
  // Global (many remote or India/Japan/Germany roles)
  ["greenhouse", "gitlab", "GitLab"],
  ["greenhouse", "coinbase", "Coinbase"],
  ["greenhouse", "airbnb", "Airbnb"],
  ["greenhouse", "rubrik", "Rubrik"],
  ["ashby", "cohere", "Cohere"],
  ["ashby", "linear", "Linear"],
  ["ashby", "ramp", "Ramp"],
  ["smartrecruiters", "ServiceNow", "ServiceNow"],
  ["recruitee", "bunq", "bunq"],
  // More India
  ["greenhouse", "inmobi", "InMobi"],
  ["greenhouse", "clear", "Clear (ClearTax)"],
  ["greenhouse", "slice", "slice"],
  ["lever", "fi", "Fi Money"],
  ["ashby", "navi", "Navi"],
];

const env = (name: string) => process.env[name]?.trim() || "";

const PROVIDER_NAMES: Record<BoardProvider, string> = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", recruitee: "Recruitee",
};

/** Every source with whether it can run (API keys present). */
export function listSources(): Source[] {
  const boards: Source[] = COMPANY_BOARDS.map(([provider, slug, company]) => ({
    key: `${provider}:${slug}`,
    provider: PROVIDER_NAMES[provider],
    board: `${provider}:${slug}`,
    company,
    kind: "company",
    missing: [],
  }));
  const feed = (key: string, provider: string, kind: SourceKind, missing: string[] = []): Source => ({
    key, provider, board: key, company: "Many companies", kind, missing: missing.filter((name) => !env(name)),
  });
  return [
    ...boards,
    feed("remotive", "Remotive", "feed"),
    feed("remoteok", "Remote OK", "feed"),
    feed("hackernews", "Hacker News", "feed"),
    feed("arbeitnow", "Arbeitnow", "feed"),
    feed("themuse", "The Muse", "feed"),
    feed("himalayas", "Himalayas", "feed"),
    feed("adzuna", "Adzuna", "aggregator", ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"]),
    feed("jooble", "Jooble", "aggregator", ["JOOBLE_API_KEY"]),
    feed("jsearch", "JSearch", "aggregator", ["JSEARCH_API_KEY"]),
    feed("findwork", "Findwork", "aggregator", ["FINDWORK_API_KEY"]),
    feed("usajobs", "USAJOBS", "aggregator", ["USAJOBS_API_KEY", "USAJOBS_EMAIL"]),
  ];
}

/** Cache tag of the free sources (company boards and keyless feeds): "Refresh" may re-fetch these. */
export const FREE_SOURCES_TAG = "discover-free";

/** Seconds each source stays fresh. Keyed sources are slower to respect their free quotas. */
const REVALIDATE: Record<string, number> = {
  company: 15 * 60,
  remotive: 6 * 3600, // Remotive asks for at most ~4 calls a day
  remoteok: 3 * 3600,
  hackernews: 6 * 3600, // one thread a month
  arbeitnow: 3600,
  themuse: 3600,
  himalayas: 3600,
  adzuna: 2 * 3600, // ~24 calls/day
  jooble: 2 * 3600,
  jsearch: 12 * 3600, // free plan: ~200 requests/month
  findwork: 2 * 3600,
  usajobs: 6 * 3600,
};

type MemoryEntry = { result: Promise<SourceResult>; fresh: number; expires: number };

/** In-memory copy per server instance: instant filter changes, and the cache also works in `next dev`. */
const memory = new Map<string, MemoryEntry>();

/**
 * A source's postings, fast: from this instance's memory while fresh; after that it's re-fetched in the
 * background while the old copy is still served (until it fully expires). Failures aren't kept.
 */
export function sourcePostings(key: string): Promise<SourceResult> {
  const now = Date.now();
  const entry = memory.get(key);
  if (entry && now < entry.fresh) return entry.result;
  const kind = key.includes(":") ? "company" : key;
  const freshMs = (REVALIDATE[kind] ?? 3600) * 1000;
  const next = fetchSource(key);
  const stored: MemoryEntry = { result: next, fresh: now + freshMs, expires: now + freshMs * 4 };
  next.then(
    () => memory.set(key, stored),
    () => { if (memory.get(key) === stored) memory.delete(key); },
  );
  if (entry && now < entry.expires) {
    // Serve the previous copy now; the new one replaces it when it arrives
    entry.fresh = now + 60_000;
    return entry.result;
  }
  memory.set(key, stored);
  return next;
}

/** "Refresh": forget this instance's copies of the free sources. */
export function forgetFreeSources() {
  for (const key of memory.keys()) {
    if (key.includes(":") || ["remotive", "remoteok", "hackernews", "arbeitnow", "themuse", "himalayas"].includes(key)) memory.delete(key);
  }
}

/**
 * One source's postings, cached and shared by all users. A failure throws (and isn't cached), so the next
 * request tries again; the caller reports it without breaking the other sources.
 */
export async function fetchSource(key: string): Promise<SourceResult> {
  "use cache: remote";
  const kind = key.includes(":") ? "company" : key;
  const revalidate = REVALIDATE[kind] ?? 3600;
  cacheLife({ stale: 300, revalidate, expire: Math.max(revalidate * 4, 86400) });
  if (kind === "company" || ["remotive", "remoteok", "hackernews", "arbeitnow", "themuse", "himalayas"].includes(key)) {
    cacheTag(FREE_SOURCES_TAG);
  }
  const postings = await load(key);
  return { postings, fetchedAt: new Date().toISOString() };
}

async function load(key: string): Promise<RawPosting[]> {
  if (key.includes(":")) {
    const [provider, slug] = key.split(":");
    const board = COMPANY_BOARDS.find(([p, s]) => p === provider && s === slug);
    if (!board) throw new Error(`Unknown board ${key}`);
    if (provider === "greenhouse") return greenhouse(slug, board[2]);
    if (provider === "lever") return lever(slug, board[2]);
    if (provider === "smartrecruiters") return smartRecruiters(slug, board[2]);
    if (provider === "recruitee") return recruitee(slug, board[2]);
    return ashby(slug, board[2]);
  }
  switch (key) {
    case "remotive": return remotive();
    case "remoteok": return remoteOk();
    case "hackernews": return hackerNews();
    case "arbeitnow": return arbeitnow();
    case "themuse": return theMuse();
    case "himalayas": return himalayas();
    case "adzuna": return adzuna();
    case "jooble": return jooble();
    case "jsearch": return jsearch();
    case "findwork": return findwork();
    case "usajobs": return usajobs();
    default: throw new Error(`Unknown source ${key}`);
  }
}

// ---- helpers ----

// Some boards return a few MB (all postings at once); allow time on a cold start
const TIMEOUT_MS = 15_000;

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": "CareerPilot/1.0 (job search for students)", ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** Only http(s) links reach the browser. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number"
    ? new Date(value < 10_000_000_000 ? value * 1000 : value) // seconds or milliseconds
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function workplace(value: unknown, remote?: boolean | null): WorkplaceType {
  const v = typeof value === "string" ? value.toLowerCase().replace(/[^a-z]/g, "") : "";
  if (v === "remote" || remote === true) return "REMOTE";
  if (v === "hybrid") return "HYBRID";
  if (v === "onsite" || v === "inoffice" || v === "office") return "ONSITE";
  return "UNSPECIFIED";
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Drops postings without a title or a safe link. */
function posting(p: Omit<RawPosting, "url" | "title"> & { url: unknown; title: unknown }): RawPosting | null {
  const url = safeUrl(p.url);
  const title = text(p.title);
  return url && title ? { ...p, url, title: title.slice(0, 300), company: p.company.slice(0, 200) } : null;
}

const notNull = <T,>(value: T | null): value is T => value !== null;

// ---- company job boards ----

type GreenhouseJob = { id: number; title: string; location?: { name?: string }; absolute_url: string; first_published?: string; updated_at?: string };

async function greenhouse(slug: string, company: string): Promise<RawPosting[]> {
  const data = await getJson<{ jobs?: GreenhouseJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  return (data.jobs ?? []).map((job) => {
    const location = text(job.location?.name);
    return posting({
      id: `greenhouse-${slug}-${job.id}`, title: job.title, company, location, department: null,
      // The list endpoint has no workplace field; "Remote" usually appears in the location name.
      workplaceType: location?.toLowerCase().includes("remote") ? "REMOTE" : "UNSPECIFIED",
      url: job.absolute_url, postedAt: isoDate(job.first_published ?? job.updated_at), source: "Greenhouse",
    });
  }).filter(notNull);
}

type LeverJob = { id: string; text: string; categories?: { location?: string; team?: string; department?: string }; createdAt?: number; workplaceType?: string; hostedUrl: string };

async function lever(slug: string, company: string): Promise<RawPosting[]> {
  const jobs = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  return (Array.isArray(jobs) ? jobs : []).map((job) => posting({
    id: `lever-${slug}-${job.id}`, title: job.text, company, location: text(job.categories?.location),
    department: text(job.categories?.team) ?? text(job.categories?.department), workplaceType: workplace(job.workplaceType),
    url: job.hostedUrl, postedAt: isoDate(job.createdAt), source: "Lever",
  })).filter(notNull);
}

type AshbyJob = { id: string; title: string; department?: string; location?: string; publishedAt?: string; isListed?: boolean; isRemote?: boolean; workplaceType?: string; jobUrl: string };

async function ashby(slug: string, company: string): Promise<RawPosting[]> {
  const data = await getJson<{ jobs?: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  return (data.jobs ?? []).filter((job) => job.isListed !== false).map((job) => posting({
    id: `ashby-${slug}-${job.id}`, title: job.title, company, location: text(job.location), department: text(job.department),
    workplaceType: workplace(job.workplaceType, job.isRemote), url: job.jobUrl, postedAt: isoDate(job.publishedAt), source: "Ashby",
  })).filter(notNull);
}

type SmartRecruitersJob = { id: string; name: string; releasedDate?: string; company?: { identifier?: string };
  location?: { city?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string };
  department?: { label?: string }; function?: { label?: string } };

/** SmartRecruiters: newest 200 postings, with structured city and country. */
async function smartRecruiters(slug: string, company: string): Promise<RawPosting[]> {
  const pages = await Promise.all([0, 100].map((offset) => getJson<{ content?: SmartRecruitersJob[] }>(
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100&offset=${offset}`,
  )));
  return pages.flatMap((page) => page.content ?? []).map((job) => {
    const remote = job.location?.remote === true;
    return posting({
      id: `smartrecruiters-${slug}-${job.id}`, title: job.name, company,
      location: text(job.location?.fullLocation?.replace(/,s*,/g, ",")) ?? text(job.location?.city),
      department: text(job.department?.label) ?? text(job.function?.label),
      workplaceType: remote ? "REMOTE" : job.location?.hybrid ? "HYBRID" : "UNSPECIFIED",
      url: `https://jobs.smartrecruiters.com/${encodeURIComponent(slug)}/${encodeURIComponent(job.id)}`,
      postedAt: isoDate(job.releasedDate), source: "SmartRecruiters",
      places: [{ country: countryName(job.location?.country), city: cityName(job.location?.city), remote }],
    });
  }).filter(notNull);
}

type RecruiteeJob = { id: number; title: string; city?: string; country?: string; remote?: boolean; hybrid?: boolean;
  careers_url: string; published_at?: string; department?: string; location?: string };

/** Recruitee: all open offers, with structured city and country. */
async function recruitee(slug: string, company: string): Promise<RawPosting[]> {
  const data = await getJson<{ offers?: RecruiteeJob[] }>(`https://${slug}.recruitee.com/api/offers/`);
  return (data.offers ?? []).map((job) => posting({
    id: `recruitee-${slug}-${job.id}`, title: job.title, company,
    location: text(job.location) ?? ([job.city, job.country].filter(Boolean).join(", ") || null),
    department: text(job.department), workplaceType: job.remote ? "REMOTE" : job.hybrid ? "HYBRID" : "UNSPECIFIED",
    url: job.careers_url, postedAt: isoDate(job.published_at), source: "Recruitee",
    places: [{ country: countryName(job.country), city: cityName(job.city), remote: job.remote === true }],
  })).filter(notNull);
}

// ---- free job boards (no key) ----

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Hacker News comment HTML → plain text (tags removed, entities decoded, paragraphs as new lines). */
function htmlToText(html: string) {
  return html
    .replace(/<p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** The first email in the post, including common disguises: "jobs [at] acme [dot] com", "jobs(at)acme.com". */
export function findEmail(text: string): string | null {
  const plain = text
    .replace(/\s*[[(<{]\s*at\s*[\])>}]\s*/gi, "@")
    .replace(/\s*[[(<{]\s*dot\s*[\])>}]\s*/gi, ".");
  const match = plain.match(EMAIL)?.[0]?.replace(/\.$/, "");
  return match && match.length <= 254 && !/\.(png|jpe?g|gif|svg)$/i.test(match) ? match.toLowerCase() : null;
}

const ROLE_WORDS = /engineer|developer|scientist|architect|sre|devops|programmer|swe|sde|designer|analyst|lead|cto|head of|manager|researcher|intern|founding/i;
const PLACE_WORDS = /remote|onsite|on-site|hybrid|\b[A-Z]{2}\b|,|city|york|london|berlin|bengaluru|bangalore|tokyo|india|germany|japan|usa|europe|emea|apac|worldwide/i;

type HnItem = { id: number; created_at_i?: number; text?: string | null; children?: HnItem[] };

/**
 * Hacker News "Ask HN: Who is hiring?": the latest monthly thread, one posting per top-level comment.
 * Companies write "Company | Role | Location | …" on the first line and often a hiring email in the text.
 */
async function hackerNews(): Promise<RawPosting[]> {
  const stories = await getJson<{ hits?: { objectID: string; title?: string }[] }>(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10",
  );
  const thread = stories.hits?.find((hit) => /^ask hn: who is hiring\?/i.test(hit.title ?? ""));
  if (!thread) return [];
  const item = await getJson<HnItem>(`https://hn.algolia.com/api/v1/items/${encodeURIComponent(thread.objectID)}`);
  return (item.children ?? []).map((comment) => {
    if (!comment.text) return null;
    const text = htmlToText(comment.text);
    const firstLine = text.split("\n")[0].trim();
    const parts = firstLine.split(/\s+[|—–]\s+|\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const company = parts[0].replace(/\s*\(.*?\)\s*/g, " ").trim();
    // Work-mode words aren't a role ("Company | ONSITE | City" → "Open roles")
    const role = parts.slice(1).find((part) => ROLE_WORDS.test(part))
      ?? parts.slice(1).find((part) => !/^(remote|onsite|on-site|hybrid|full[- ]?time|part[- ]?time|contract)/i.test(part) && !PLACE_WORDS.test(part))
      ?? "Open roles";
    const location = parts.slice(1).filter((part) => part !== role && PLACE_WORDS.test(part) && part.length <= 80).join(", ");
    return posting({
      id: `hackernews-${comment.id}`, title: role, company: company || "Unknown", location: location || null,
      department: firstLine.slice(0, 200),
      workplaceType: /remote/i.test(firstLine) ? "REMOTE" : /onsite|on-site/i.test(firstLine) ? "ONSITE" : /hybrid/i.test(firstLine) ? "HYBRID" : "UNSPECIFIED",
      url: `https://news.ycombinator.com/item?id=${comment.id}`, postedAt: isoDate(comment.created_at_i), source: "Hacker News",
      contactEmail: findEmail(text) ?? undefined,
    });
  }).filter(notNull);
}

type RemoteOkJob = { id?: string; slug?: string; epoch?: number; date?: string; company?: string; position?: string;
  tags?: string[]; location?: string; url?: string; apply_url?: string };

/** Remote OK: remote jobs. Their terms: link back to the Remote OK page and name Remote OK as the source. */
async function remoteOk(): Promise<RawPosting[]> {
  const data = await getJson<RemoteOkJob[]>("https://remoteok.com/api");
  return (Array.isArray(data) ? data : []).filter((job) => job.id && job.position).map((job) => posting({
    id: `remoteok-${job.id}`, title: job.position, company: job.company ?? "Unknown",
    location: text(job.location) ?? "Remote", department: (job.tags ?? []).join(", ") || null, workplaceType: "REMOTE",
    url: job.url, postedAt: isoDate(job.date ?? job.epoch), source: "Remote OK",
  })).filter(notNull);
}

type RemotiveJob = { id: number; url: string; title: string; company_name: string; category?: string; job_type?: string; publication_date?: string; candidate_required_location?: string };

/** Remotive: remote software jobs. Their terms: link back to Remotive and name it as the source. */
async function remotive(): Promise<RawPosting[]> {
  const data = await getJson<{ jobs?: RemotiveJob[] }>("https://remotive.com/api/remote-jobs?category=software-dev");
  return (data.jobs ?? []).map((job) => posting({
    id: `remotive-${job.id}`, title: job.title, company: job.company_name ?? "Unknown",
    location: text(job.candidate_required_location), department: text(job.category), workplaceType: "REMOTE",
    url: job.url, postedAt: isoDate(job.publication_date), source: "Remotive",
  })).filter(notNull);
}

type ArbeitnowJob = { slug: string; company_name: string; title: string; remote?: boolean; url: string; tags?: string[]; location?: string; created_at?: number };

async function arbeitnow(): Promise<RawPosting[]> {
  const data = await getJson<{ data?: ArbeitnowJob[] }>("https://www.arbeitnow.com/api/job-board-api");
  return (data.data ?? []).map((job) => posting({
    id: `arbeitnow-${job.slug}`, title: job.title, company: job.company_name ?? "Unknown", location: text(job.location),
    department: (job.tags ?? []).join(", ") || null, workplaceType: job.remote ? "REMOTE" : "UNSPECIFIED",
    url: job.url, postedAt: isoDate(job.created_at), source: "Arbeitnow",
  })).filter(notNull);
}

type MuseJob = { id: number; name: string; publication_date?: string; locations?: { name: string }[]; categories?: { name: string }[]; refs?: { landing_page?: string }; company?: { name?: string } };

/** The Muse: software engineering jobs, newest first (5 pages of 20). Works without a key; a key raises limits. */
async function theMuse(): Promise<RawPosting[]> {
  const key = env("THEMUSE_API_KEY");
  const pages = await Promise.all([0, 1, 2, 3, 4].map((page) => getJson<{ results?: MuseJob[] }>(
    `https://www.themuse.com/api/public/jobs?category=Software%20Engineering&page=${page}${key ? `&api_key=${encodeURIComponent(key)}` : ""}`,
  )));
  return pages.flatMap((data) => data.results ?? []).map((job) => {
    const location = (job.locations ?? []).map((l) => l.name).join("; ") || null;
    return posting({
      id: `themuse-${job.id}`, title: job.name, company: job.company?.name ?? "Unknown", location,
      department: (job.categories ?? []).map((c) => c.name).join(", ") || null,
      workplaceType: location?.toLowerCase().includes("remote") ? "REMOTE" : "UNSPECIFIED",
      url: job.refs?.landing_page, postedAt: isoDate(job.publication_date), source: "The Muse",
    });
  }).filter(notNull);
}

type HimalayasJob = { title: string; companyName: string; locationRestrictions?: string[]; categories?: string[]; parentCategories?: string[]; pubDate?: number; applicationLink?: string; guid?: string };

/** Himalayas: remote jobs feed (cursor paging, 5 pages). */
async function himalayas(): Promise<RawPosting[]> {
  const jobs: HimalayasJob[] = [];
  let cursor = "";
  for (let page = 0; page < 5; page++) {
    const data = await getJson<{ jobs?: HimalayasJob[]; nextCursor?: string }>(
      `https://himalayas.app/jobs/api?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    jobs.push(...(data.jobs ?? []));
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return jobs.map((job) => posting({
    id: `himalayas-${job.guid ?? job.applicationLink}`, title: job.title, company: job.companyName ?? "Unknown",
    location: (job.locationRestrictions ?? []).join(", ") || "Remote",
    // The main category only ("Developer"); the long tag list stays out of the cards
    department: (job.parentCategories ?? []).join(", ") || null,
    workplaceType: "REMOTE", url: job.applicationLink ?? job.guid, postedAt: isoDate(job.pubDate), source: "Himalayas",
  })).filter(notNull);
}

// ---- aggregators (API key needed) ----

type AdzunaJob = { id: string; title: string; company?: { display_name?: string }; location?: { display_name?: string }; redirect_url: string; created?: string; category?: { label?: string } };

/** Adzuna: IT jobs in ADZUNA_COUNTRY (default India, "in"), 2 pages of 50. */
async function adzuna(): Promise<RawPosting[]> {
  const country = (env("ADZUNA_COUNTRY") || "in").toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
  const auth = `app_id=${encodeURIComponent(env("ADZUNA_APP_ID"))}&app_key=${encodeURIComponent(env("ADZUNA_APP_KEY"))}`;
  const pages = await Promise.all([1, 2].map((page) => getJson<{ results?: AdzunaJob[] }>(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${auth}&results_per_page=50&category=it-jobs&sort_by=date`,
  )));
  return pages.flatMap((data) => data.results ?? []).map((job) => posting({
    id: `adzuna-${job.id}`, title: job.title, company: job.company?.display_name ?? "Unknown",
    location: text(job.location?.display_name), department: text(job.category?.label),
    workplaceType: workplace(null, /remote/i.test(job.title)), url: job.redirect_url, postedAt: isoDate(job.created), source: "Adzuna",
  })).filter(notNull);
}

type JoobleJob = { id: string | number; title: string; location?: string; type?: string; link: string; company?: string; updated?: string };

/** Jooble: "software developer" in JOOBLE_LOCATION (default India). */
async function jooble(): Promise<RawPosting[]> {
  const data = await getJson<{ jobs?: JoobleJob[] }>(`https://jooble.org/api/${encodeURIComponent(env("JOOBLE_API_KEY"))}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords: env("JOOBLE_KEYWORDS") || "software developer", location: env("JOOBLE_LOCATION") || "India", page: "1" }),
  });
  return (data.jobs ?? []).map((job) => posting({
    id: `jooble-${job.id}`, title: job.title, company: text(job.company) ?? "Unknown", location: text(job.location),
    department: null, workplaceType: workplace(null, /remote/i.test(`${job.title} ${job.location ?? ""}`)),
    url: job.link, postedAt: isoDate(job.updated), source: "Jooble",
  })).filter(notNull);
}

type JSearchJob = { job_id: string; job_title: string; employer_name?: string; job_city?: string; job_state?: string; job_country?: string; job_apply_link: string; job_posted_at_datetime_utc?: string; job_is_remote?: boolean };

/** JSearch (RapidAPI, Google for Jobs data): JSEARCH_QUERY (default "software developer in India"), last week. */
async function jsearch(): Promise<RawPosting[]> {
  const query = encodeURIComponent(env("JSEARCH_QUERY") || "software developer in India");
  const data = await getJson<{ data?: JSearchJob[] }>(
    `https://jsearch.p.rapidapi.com/search?query=${query}&page=1&num_pages=2&date_posted=week`,
    { headers: { "x-rapidapi-key": env("JSEARCH_API_KEY"), "x-rapidapi-host": "jsearch.p.rapidapi.com" } },
  );
  return (data.data ?? []).map((job) => posting({
    id: `jsearch-${job.job_id}`, title: job.job_title, company: job.employer_name ?? "Unknown",
    location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || null, department: null,
    workplaceType: job.job_is_remote ? "REMOTE" : "UNSPECIFIED", url: job.job_apply_link,
    postedAt: isoDate(job.job_posted_at_datetime_utc), source: "JSearch",
  })).filter(notNull);
}

type FindworkJob = { id: number; role: string; company_name: string; location?: string; remote?: boolean; url: string; date_posted?: string; keywords?: string[] };

async function findwork(): Promise<RawPosting[]> {
  const data = await getJson<{ results?: FindworkJob[] }>("https://findwork.dev/api/jobs/?sort_by=date", {
    headers: { Authorization: `Token ${env("FINDWORK_API_KEY")}` },
  });
  return (data.results ?? []).map((job) => posting({
    id: `findwork-${job.id}`, title: job.role, company: job.company_name ?? "Unknown", location: text(job.location),
    department: (job.keywords ?? []).join(", ") || null, workplaceType: job.remote ? "REMOTE" : "UNSPECIFIED",
    url: job.url, postedAt: isoDate(job.date_posted), source: "Findwork",
  })).filter(notNull);
}

type UsaJob = { MatchedObjectDescriptor: { PositionID: string; PositionTitle: string; OrganizationName?: string; PositionLocationDisplay?: string; PositionURI: string; PublicationStartDate?: string } };

/** USAJOBS: US federal IT jobs (series 2210). Needs a key and the email it was registered with. */
async function usajobs(): Promise<RawPosting[]> {
  const data = await getJson<{ SearchResult?: { SearchResultItems?: UsaJob[] } }>(
    "https://data.usajobs.gov/api/search?JobCategoryCode=2210&ResultsPerPage=100&SortField=opendate&SortDirection=desc",
    { headers: { "User-Agent": env("USAJOBS_EMAIL"), "Authorization-Key": env("USAJOBS_API_KEY") } },
  );
  return (data.SearchResult?.SearchResultItems ?? []).map(({ MatchedObjectDescriptor: job }) => posting({
    id: `usajobs-${job.PositionID}`, title: job.PositionTitle, company: job.OrganizationName ?? "US Government",
    location: text(job.PositionLocationDisplay), department: "Information Technology",
    workplaceType: workplace(null, /remote/i.test(job.PositionLocationDisplay ?? "")), url: job.PositionURI,
    postedAt: isoDate(job.PublicationStartDate), source: "USAJOBS",
  })).filter(notNull);
}
