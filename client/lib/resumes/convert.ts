import type {
  ResumeData,
  ResumeEntry,
  ResumeLayout,
  ResumeListItem,
  ResumeSection,
  ResumeSkillGroup,
  SectionType,
} from "@/lib/api/resumes";

/*
 * Lenient conversion: any JSON becomes a resume the server will render.
 * Nothing is rejected here — unknown shapes are mapped as well as possible and values are clipped to the
 * server's limits (ResumeData.java). Stricter rules come in a later phase.
 */

// ---- limits (mirror ResumeData.java) ----

const MAX = {
  name: 100, headline: 150, email: 254, phone: 40, location: 100, links: 6, linkLabel: 40, url: 500,
  sections: 25, sectionTitle: 60, entries: 40, content: 4000, items: 50, groups: 30,
  entryTitle: 150, subtitle: 150, entryLocation: 100, date: 30, description: 1500, bullets: 20, bullet: 500,
  itemText: 500, groupName: 60, keywords: 50, keyword: 60,
} as const;

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_LIKE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?$/i;
const SECTION_TYPES: SectionType[] = ["entries", "text", "list", "skills"];

function cut(value: unknown, max: number): string | null {
  const text = str(value).trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function str(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(str).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => (str(v) ? `${humanize(k)}: ${str(v)}` : ""))
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

const safeUrl = (value: unknown) => {
  const url = str(value).trim();
  return url && url.length <= MAX.url && URL_LIKE.test(url) ? url : null;
};

const validId = (id: unknown) => (typeof id === "string" && ID.test(id) ? id : undefined);

/** Clips every value to the server's limits and fills required fields, so validation can't fail. */
export function fitToLimits(data: ResumeData): ResumeData {
  const b = data.basics ?? { fullName: "" };
  const links = (b.links ?? [])
    .map((l) => ({ label: cut(l?.label, MAX.linkLabel), url: safeUrl(l?.url) }))
    .filter((l): l is { label: string | null; url: string } => !!l.url)
    .slice(0, MAX.links);
  const email = str(b.email).trim();

  const sections = (data.sections ?? []).slice(0, MAX.sections).map((s): ResumeSection => {
    const type: SectionType = SECTION_TYPES.includes(s?.type) ? s.type : "list";
    const base = { id: validId(s?.id), type, title: cut(s?.title, MAX.sectionTitle) ?? "Section", visible: s?.visible !== false };
    switch (type) {
      case "text":
        return { ...base, content: cut(s.content, MAX.content) };
      case "list":
        return {
          ...base,
          items: (s.items ?? [])
            .map((i): ResumeListItem | null => {
              const text = cut(i?.text, MAX.itemText);
              return text ? { id: validId(i.id), text, visible: i.visible !== false } : null;
            })
            .filter((i): i is ResumeListItem => !!i)
            .slice(0, MAX.items),
        };
      case "skills":
        return {
          ...base,
          groups: (s.groups ?? [])
            .map((g): ResumeSkillGroup => ({
              id: validId(g?.id),
              name: cut(g?.name, MAX.groupName),
              keywords: (g?.keywords ?? []).map((k) => cut(k, MAX.keyword)).filter((k): k is string => !!k).slice(0, MAX.keywords),
              visible: g?.visible !== false,
            }))
            .filter((g) => g.name || (g.keywords?.length ?? 0) > 0)
            .slice(0, MAX.groups),
        };
      case "entries":
        return {
          ...base,
          entries: (s.entries ?? []).slice(0, MAX.entries).map((e): ResumeEntry => {
            const subtitle = cut(e?.subtitle, MAX.subtitle);
            return {
              id: validId(e?.id),
              title: cut(e?.title, MAX.entryTitle) ?? subtitle ?? "Untitled",
              subtitle: cut(e?.title, MAX.entryTitle) ? subtitle : null,
              location: cut(e?.location, MAX.entryLocation),
              startDate: cut(e?.startDate, MAX.date),
              endDate: e?.current ? null : cut(e?.endDate, MAX.date),
              current: !!e?.current,
              url: safeUrl(e?.url),
              description: cut(e?.description, MAX.description),
              bullets: (e?.bullets ?? []).map((x) => cut(x, MAX.bullet)).filter((x): x is string => !!x).slice(0, MAX.bullets),
              visible: e?.visible !== false,
            };
          }),
        };
    }
  });

  return {
    schemaVersion: 2,
    basics: {
      fullName: cut(b.fullName, MAX.name) ?? "Your name",
      headline: cut(b.headline, MAX.headline),
      email: email && email.length <= MAX.email && EMAIL.test(email) ? email : null,
      phone: cut(b.phone, MAX.phone),
      location: cut(b.location, MAX.location),
      links,
    },
    sections,
    layout: fitLayout(data.layout),
  };
}

const MARGIN_KEYS = ["marginTop", "marginRight", "marginBottom", "marginLeft"] as const;

/** Margins clamped to the server's 5–40 mm; null when none are set. */
function fitLayout(layout: ResumeLayout | null | undefined): ResumeLayout | null {
  if (!isObject(layout)) return null;
  const fitted: ResumeLayout = {};
  for (const key of MARGIN_KEYS) {
    const value = Number(layout[key]);
    if (layout[key] != null && Number.isFinite(value)) fitted[key] = Math.round(Math.min(40, Math.max(5, value)) * 10) / 10;
  }
  return Object.keys(fitted).length ? fitted : null;
}

// ---- any JSON ----

const KNOWN_TITLES: Record<string, string> = {
  work: "Experience", experience: "Experience", employment: "Experience", jobs: "Experience",
  education: "Education", projects: "Projects", skills: "Skills", awards: "Awards",
  certificates: "Certifications", certifications: "Certifications", publications: "Publications",
  languages: "Languages", interests: "Interests", references: "References", volunteer: "Volunteering",
  summary: "Summary", about: "About", objective: "Objective",
};
const BASICS_KEYS = ["basics", "personal", "personalInfo", "personal_info", "contact", "contactInfo", "header"];
const META_KEYS = new Set(["$schema", "meta", "schemaVersion", "version", "id", "_id", "createdAt", "updatedAt"]);

function humanize(key: string) {
  const words = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function pick(o: Record<string, unknown>, keys: string[], used?: Set<string>): string {
  for (const key of keys) {
    const match = Object.keys(o).find((k) => k.toLowerCase() === key.toLowerCase());
    if (match && str(o[match]).trim() && !isObject(o[match])) {
      used?.add(match);
      return str(o[match]).trim();
    }
  }
  return "";
}

/** Is this already (roughly) CareerPilot's format? Then the server can read it as-is. */
export function looksLikeResumeJson(value: unknown): boolean {
  return isObject(value) && isObject(value.basics) && Array.isArray(value.sections);
}

/** Maps any JSON (JSON Resume, LinkedIn exports, hand-made objects…) to a resume. */
export function fromAnyJson(input: unknown): ResumeData {
  let value = input;
  if (isObject(value) && isObject(value.data) && Object.keys(value).length <= 3) value = value.data;
  if (looksLikeResumeJson(value)) return fitToLimits(value as ResumeData);
  if (Array.isArray(value)) value = { details: value };
  if (!isObject(value)) return fitToLimits({ basics: { fullName: "" }, sections: [{ type: "text", title: "Details", content: str(value) }] });

  const root = value;
  const used = new Set<string>();
  const basicsKey = Object.keys(root).find((k) => BASICS_KEYS.some((b) => b.toLowerCase() === k.toLowerCase()) && isObject(root[k]));
  const src = basicsKey ? (root[basicsKey] as Record<string, unknown>) : root;
  if (basicsKey) used.add(basicsKey);
  const srcUsed = basicsKey ? new Set<string>() : used;

  const first = pick(src, ["firstName", "first_name", "givenName"], srcUsed);
  const last = pick(src, ["lastName", "last_name", "familyName"], srcUsed);
  const fullName = pick(src, ["fullName", "full_name", "name"], srcUsed) || [first, last].filter(Boolean).join(" ");
  const headline = pick(src, ["headline", "label", "title", "role", "position", "jobTitle"], srcUsed);
  const email = pick(src, ["email", "mail", "emailAddress"], srcUsed);
  const phone = pick(src, ["phone", "phoneNumber", "mobile", "tel"], srcUsed);
  let location = pick(src, ["location", "address", "city"], srcUsed);
  const locKey = Object.keys(src).find((k) => /^(location|address)$/i.test(k) && isObject(src[k]));
  if (!location && locKey) {
    const l = src[locKey] as Record<string, unknown>;
    location = [pick(l, ["city"]), pick(l, ["region", "state"]), pick(l, ["country", "countryCode"])].filter(Boolean).join(", ");
    srcUsed.add(locKey);
  }

  const links: { label: string | null; url: string }[] = [];
  const addLink = (label: string | null, url: unknown) => {
    const u = safeUrl(url);
    if (u && !links.some((l) => l.url === u)) links.push({ label, url: u });
  };
  const site = pick(src, ["url", "website", "portfolio", "homepage"], srcUsed);
  if (site) addLink("Website", site);
  for (const key of ["profiles", "links", "socials", "social"]) {
    for (const o of [src, root]) {
      const match = Object.keys(o).find((k) => k.toLowerCase() === key);
      if (!match || !Array.isArray(o[match])) continue;
      for (const item of o[match] as unknown[]) {
        if (isObject(item)) addLink(pick(item, ["network", "label", "name", "title"]) || null, pick(item, ["url", "link", "href"]));
        else addLink(null, item);
      }
      (o === src ? srcUsed : used).add(match);
    }
  }
  // Social keys as plain strings: { "github": "github.com/x" }
  for (const [k, v] of Object.entries(src)) {
    if (/^(github|linkedin|twitter|x|gitlab|stackoverflow|medium|blog)$/i.test(k) && typeof v === "string") {
      addLink(humanize(k), v);
      srcUsed.add(k);
    }
  }

  const sections: ResumeSection[] = [];
  // Leftover basics fields (e.g. "summary") become sections too
  if (basicsKey) {
    for (const [k, v] of Object.entries(src)) if (!srcUsed.has(k)) addSection(sections, k, v);
  }
  for (const [k, v] of Object.entries(root)) {
    if (used.has(k) || META_KEYS.has(k)) continue;
    if (!basicsKey && srcUsed.has(k)) continue;
    addSection(sections, k, v);
  }

  return fitToLimits({ basics: { fullName, headline, email, phone, location, links }, sections });
}

function addSection(sections: ResumeSection[], key: string, value: unknown) {
  const title = KNOWN_TITLES[key.toLowerCase()] ?? humanize(key);
  const skillsLike = /skill|tech|tool|stack|competenc/i.test(key);

  if (value == null || str(value).trim() === "") return;

  if (!Array.isArray(value) && !isObject(value)) {
    if (skillsLike) sections.push({ type: "skills", title, groups: [{ keywords: splitKeywords(str(value)) }] });
    else sections.push({ type: "text", title, content: str(value) });
    return;
  }

  if (isObject(value)) {
    const entries = Object.entries(value).filter(([, v]) => str(v).trim());
    if (skillsLike) {
      sections.push({
        type: "skills", title,
        groups: entries.map(([k, v]) => ({ name: humanize(k), keywords: Array.isArray(v) ? v.map(str) : splitKeywords(str(v)) })),
      });
    } else {
      sections.push({ type: "list", title, items: entries.map(([k, v]) => ({ text: `${humanize(k)}: ${str(v)}` })) });
    }
    return;
  }

  const list = value.filter((v) => str(v).trim());
  if (list.every((v) => !isObject(v))) {
    if (skillsLike) sections.push({ type: "skills", title, groups: [{ keywords: list.map(str) }] });
    else sections.push({ type: "list", title, items: list.map((v) => ({ text: str(v) })) });
    return;
  }

  if (skillsLike) {
    sections.push({
      type: "skills", title,
      groups: list.map((v) => {
        if (!isObject(v)) return { keywords: [str(v)] };
        const name = pick(v, ["name", "category", "title", "group"]);
        const kwKey = Object.keys(v).find((k) => /keyword|items|skills|list|values|tools/i.test(k));
        const keywords = kwKey ? (Array.isArray(v[kwKey]) ? (v[kwKey] as unknown[]).map(str) : splitKeywords(str(v[kwKey]))) : [];
        return keywords.length ? { name, keywords } : { keywords: [name || str(v)] };
      }),
    });
    return;
  }

  const entries = list.map((v) => (isObject(v) ? toEntry(v) : { title: str(v) }));
  // Short records without dates or bullets (languages, interests…) read better as a list
  const simple = entries.every((e) => !e.startDate && !e.endDate && !e.bullets?.length && !e.url && (e.description ?? "").length <= 60);
  if (simple) {
    sections.push({
      type: "list", title,
      items: entries.map((e) => ({
        text: [e.title, e.subtitle].filter(Boolean).join(" — ") + (e.description ? ` (${e.description})` : ""),
      })),
    });
  } else {
    sections.push({ type: "entries", title, entries });
  }
}

function toEntry(o: Record<string, unknown>): ResumeEntry {
  const used = new Set<string>();
  const degree = pick(o, ["studyType", "degree"], used);
  const area = pick(o, ["area", "field", "fieldOfStudy", "major"], used);
  const title =
    (degree ? [degree, area].filter(Boolean).join(" in ") : "") ||
    pick(o, ["title", "position", "role", "jobTitle", "name", "award", "certification", "language", "project"], used) ||
    area;
  // JSON Resume keeps the company in "name" when "position" is the title
  const subtitle = pick(o, ["company", "organization", "organisation", "employer", "institution", "school", "university",
    "college", "issuer", "publisher", "awarder", "entity", "client", "name"], used);
  const location = pick(o, ["location", "city", "place"], used);
  const startDate = pick(o, ["startDate", "start_date", "start", "from", "since", "date", "releaseDate", "issued"], used);
  const endRaw = pick(o, ["endDate", "end_date", "end", "to", "until"], used);
  const current = o.current === true || /^(present|current|now|ongoing)$/i.test(endRaw);
  used.add("current");
  const url = pick(o, ["url", "link", "website", "href"], used);
  const description = pick(o, ["summary", "description", "details", "about", "overview"], used);

  let bullets: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v) && /highlight|bullet|responsib|achiev|accomplish|duties|tasks|points|courses|keywords|technolog|tools|stack/i.test(k)) {
      const values = v.map(str).filter(Boolean);
      bullets = bullets.concat(/keyword|technolog|tools|stack|courses/i.test(k) ? [`${humanize(k)}: ${values.join(", ")}`] : values);
      used.add(k);
    }
  }
  // Anything else worth keeping goes into the description
  const extra = Object.entries(o)
    .filter(([k, v]) => !used.has(k) && !META_KEYS.has(k) && str(v).trim())
    .map(([k, v]) => `${humanize(k)}: ${str(v)}`);

  return {
    title: title || subtitle || extra[0] || "Untitled",
    subtitle: title ? subtitle : null,
    location, startDate,
    endDate: current ? null : endRaw,
    current, url,
    description: [description, ...extra].filter(Boolean).join("\n") || null,
    bullets,
  };
}

const splitKeywords = (text: string) => text.split(/\s*[,;|•·]\s*|\n+/).map((k) => k.trim()).filter(Boolean);

// ---- text box input → resume ----

/** AI replies often wrap JSON in ``` fences or add a sentence; keep the outermost object or array. */
function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

/** Parses JSON, tolerating comments and trailing commas. Returns undefined if it still isn't JSON. */
export function parseLooseJson(text: string): unknown {
  const candidate = extractJson(text);
  if (!/^[[{]/.test(candidate)) return undefined;
  for (const attempt of [
    candidate,
    candidate.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'])\/\/.*$/gm, "$1").replace(/,\s*([}\]])/g, "$1"),
  ]) {
    try {
      return JSON.parse(attempt);
    } catch {
      // try the next form
    }
  }
  return undefined;
}
