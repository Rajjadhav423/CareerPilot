import { NextRequest, NextResponse } from "next/server";

/** Very lightweight HTML entity decoder for common entities only. */
function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Strip all HTML tags and collapse whitespace. */
function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract content of a meta tag by property or name. */
function metaContent(html: string, attr: string, value: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:${attr})=["']${value}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  let m = re.exec(html);
  if (m) return decodeEntities(m[1]);
  // Also try content first
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:${attr})=["']${value}["']`,
    "i"
  );
  m = re2.exec(html);
  return m ? decodeEntities(m[1]) : "";
}

/** Pull a JSON-LD block from the page and parse it. */
function parseJsonLd(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]) as Record<string, unknown>;
      if (obj["@type"] === "JobPosting" || obj["title"]) return obj;
    } catch {
      // continue
    }
  }
  return null;
}

/** Normalise a work-mode string into ONSITE | HYBRID | REMOTE | "". */
function toWorkMode(raw: string): "ONSITE" | "HYBRID" | "REMOTE" | "" {
  const s = raw.toLowerCase();
  if (s.includes("remote")) return "REMOTE";
  if (s.includes("hybrid")) return "HYBRID";
  if (s.includes("onsite") || s.includes("on-site") || s.includes("in-office")) return "ONSITE";
  return "";
}

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  workMode: "ONSITE" | "HYBRID" | "REMOTE" | "";
  description: string;
  jobUrl: string;
}

export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = await req.json() as { url?: unknown };
    url = (body.url as string | undefined)?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Please provide a full URL starting with https://." }, { status: 400 });
  }

  // Resolve LinkedIn short links (linkedin.com/posts/… or li.lk/…)
  let fetchUrl = url;

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        // Mimic a browser so we get the pre-rendered HTML LinkedIn serves to bots
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return NextResponse.json(
        { error: `The page responded with status ${response.status}. LinkedIn may require login for this post.` },
        { status: 422 }
      );
    }
    html = await response.text();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json({ error: "The request timed out. Try again." }, { status: 504 });
    }
    return NextResponse.json({ error: "Could not reach the URL." }, { status: 502 });
  }

  // ── Extract data ──────────────────────────────────────────────────────────
  const jsonLd = parseJsonLd(html);

  // Title — use a local to avoid mixing ?? and || without parentheses
  const titleFallback =
    metaContent(html, "property", "og:title") ||
    metaContent(html, "name", "twitter:title") ||
    (/<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? "");
  let title = decodeEntities(
    ((jsonLd?.title as string | undefined) ?? titleFallback)
  ).split("|")[0].split(" - ")[0].trim();

  // Company
  let company =
    (jsonLd?.hiringOrganization as { name?: string } | undefined)?.name ??
    (metaContent(html, "property", "og:site_name") || "");
  // For LinkedIn posts that aren't job listings, try scraping author/org name
  if (!company) {
    const m = /class="[^"]*top-card-layout__company[^"]*"[^>]*>\s*<[^>]+>\s*([^<]+)/i.exec(html);
    company = m ? decodeEntities(m[1]).trim() : "";
  }

  // Location
  let location =
    (jsonLd?.jobLocation as { address?: { addressLocality?: string; addressRegion?: string } } | undefined)
      ?.address?.addressLocality ?? "";
  if (!location) {
    const m =
      /class="[^"]*description__job-criteria-text[^"]*"[^>]*>\s*([^<]+)/i.exec(html) ??
      /class="[^"]*sub-nav-cta__meta[^"]*"[^>]*>\s*([^<]+)/i.exec(html) ??
      /class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>\s*([^<]+)/i.exec(html);
    location = m ? decodeEntities(m[1]).trim() : "";
  }

  // Work mode (from JSON-LD or text scan)
  let workMode: "ONSITE" | "HYBRID" | "REMOTE" | "" = "";
  const workTypes = jsonLd?.applicantLocationRequirements as unknown;
  if (Array.isArray(workTypes) && workTypes.length > 0) {
    workMode = toWorkMode(String(workTypes[0]));
  }
  if (!workMode) {
    workMode = toWorkMode(location + " " + title + " " + html.slice(0, 4000));
  }

  // Description
  let description = "";
  if (jsonLd?.description) {
    description = stripTags(decodeEntities(String(jsonLd.description)));
  }
  if (!description) {
    // LinkedIn job description section
    const m =
      /class="[^"]*description__text[^"]*"[^>]*>([\s\S]{20,8000}?)<\/section>/i.exec(html) ??
      /class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]{20,8000}?)<\/div>/i.exec(html) ??
      /class="[^"]*core-section-container__content[^"]*"[^>]*>([\s\S]{20,8000}?)<\/div>/i.exec(html);
    if (m) description = stripTags(decodeEntities(m[1]));
  }
  if (!description) {
    // OG description as a last-resort
    description = metaContent(html, "property", "og:description") || metaContent(html, "name", "description");
    description = decodeEntities(description);
  }

  // If we couldn't extract meaningful data, LinkedIn probably required login
  if (!title && !company && !description) {
    return NextResponse.json(
      {
        error:
          "Could not extract job details. LinkedIn may require login for this post, or this isn't a job posting URL.",
      },
      { status: 422 }
    );
  }

  const result: ScrapedJob = {
    title: title.slice(0, 200),
    company: company.slice(0, 200),
    location: location.slice(0, 200),
    workMode,
    description: description.slice(0, 20_000),
    jobUrl: url,
  };

  return NextResponse.json(result);
}
