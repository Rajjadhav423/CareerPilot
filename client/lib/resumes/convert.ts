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
 * Lenient conversion: any Markdown, plain text or JSON becomes a resume the server will render.
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

// ---- Markdown / plain text ----

const DATE = String.raw`(?:(?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}[/.-]\d{4}|\d{4}[/.-]\d{1,2})`;
const DATE_RANGE = new RegExp(String.raw`^(${DATE})(?:\s*(?:[–—-]|to)\s*(${DATE}|present|current|now|ongoing))?$`, "i");
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const BULLET = /^(?:[-*+•]|\d+[.)])\s+(.+)$/;
const MD_LINK = /^\[([^\]]+)\]\((\S+)\)$/;
const PHONE = /^\+?[\d(][\d\s().-]{6,}\d$/;

/** Removes Markdown emphasis around the whole text: "*2025*" → "2025", "**Title**" → "Title". */
const unwrap = (text: string) => text.trim().replace(/^(\*\*|__|\*|_)(.+)\1$/, "$2").trim();
const plainTitle = (text: string) => unwrap(text).replace(/\*\*|__|`/g, "").trim();
const splitParts = (line: string) => line.split(/\s+[|·•]\s+|\s*[|·•]\s*(?=\S)/).map((p) => p.trim()).filter(Boolean);

function sectionTypeFor(title: string): SectionType {
  const t = title.toLowerCase();
  if (/skill|technolog|tools|stack|competenc/.test(t)) return "skills";
  if (/summary|profile|objective|about/.test(t)) return "text";
  if (/language|award|certif|interest|publication|hobb|achievement|honou?r|link/.test(t)) return "list";
  return "entries";
}

/** "2021 – 2025 | CGPA: 7.89/10" → dates plus the rest; null if the line doesn't start with dates. */
function dateLine(line: string) {
  const [first, ...rest] = splitParts(unwrap(line)).map(unwrap);
  const match = first ? DATE_RANGE.exec(first) : null;
  if (!match) return null;
  const end = match[2]?.trim() ?? "";
  const current = /^(present|current|now|ongoing)$/i.test(end);
  return { start: match[1].trim(), end: current ? null : end || null, current, rest };
}

const UNIT_MM: Record<string, number> = { "": 1, mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 };

/** "10", "10mm", "1.5cm", "0.5in", "36pt" → millimetres; null if it isn't a length. */
function toMm(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?$/i.exec(value.trim());
  return match ? Number(match[1]) * UNIT_MM[(match[2] ?? "").toLowerCase()] : null;
}

/**
 * Page settings at the very top of the Markdown, between "---" lines (YAML-style front matter):
 *   ---
 *   margin: 12mm            (all sides; or "12 16" / "12 16 14" / "12 16 14 16" like CSS)
 *   margin-top: 10mm        (one side; "padding" works as another name for "margin")
 *   ---
 */
function readFrontMatter(lines: string[]): { layout: ResumeLayout | null; lines: string[] } {
  const start = lines.findIndex(Boolean);
  if (start < 0 || !/^-{3,}$/.test(lines[start])) return { layout: null, lines };
  const end = lines.findIndex((l, i) => i > start && /^-{3,}$/.test(l));
  if (end < 0) return { layout: null, lines };

  const layout: ResumeLayout = {};
  for (const line of lines.slice(start + 1, end)) {
    const match = /^(margin|padding)(?:[-_\s]?(top|right|bottom|left))?\s*[:=]\s*(.+?)\s*;?$/i.exec(line);
    if (!match) continue;
    const side = match[2]?.toLowerCase();
    const values = match[3].split(/[\s,]+/).map(toMm);
    if (values.some((v) => v === null)) continue;
    const [t, r = t, b = t, l = r] = values as number[];
    if (side) layout[`margin${side[0].toUpperCase()}${side.slice(1)}` as keyof ResumeLayout] = values[0] as number;
    else Object.assign(layout, { marginTop: t, marginRight: r, marginBottom: b, marginLeft: l });
  }
  return { layout: Object.keys(layout).length ? layout : null, lines: lines.slice(end + 1) };
}

type Contact = { email: string; phone: string; location: string; links: { label: string | null; url: string }[] };

/** Reads one part of a contact line ("Email: x", "LinkedIn: https://…", "+91 …"). False if it isn't contact info. */
function readContact(part: string, c: Contact): boolean {
  const text = unwrap(part);
  const labelled = /^([A-Za-z][\w .+-]{0,29}?)\s*:\s*(.+)$/.exec(text);
  const label = labelled?.[1].trim() ?? "";
  const value = (labelled ? labelled[2] : text).trim();
  const md = MD_LINK.exec(value);

  if (/^e-?mail$/i.test(label) || (!labelled && EMAIL.test(value))) {
    if (EMAIL.test(value)) c.email ||= value;
    return true;
  }
  if (/^(phone|mobile|tel|telephone|contact|cell)$/i.test(label) || (!labelled && PHONE.test(value))) {
    c.phone ||= value;
    return true;
  }
  if (/^(location|address|city|based in)$/i.test(label)) {
    c.location ||= value;
    return true;
  }
  const url = md ? md[2] : value;
  if (!/\s/.test(url) && URL_LIKE.test(url) && url.includes(".")) {
    const host = url.replace(/^https?:\/\/(www\.)?/i, "").split(/[/.]/)[0];
    c.links.push({ label: md?.[1] ?? (label || (/^(linkedin|github|gitlab|behance|dribbble|medium)$/i.test(host) ? humanize(host) : null)), url });
    return true;
  }
  return false;
}

/**
 * Markdown (or any text) → resume. Conventions, all optional:
 * "# Name"; header lines (headline, "Email: …", "Phone: …", links, location); "## Section";
 * "### Entry title — Company"; under an entry a short line (company, school or tech stack) and a dates line
 * ("*Jan 2022 – Present* | Remote"); "- bullets"; "- **Group:** a, b" in skills sections.
 * Text before the first section goes into a "Profile" section, so nothing typed is lost.
 */
export function fromMarkdown(markdown: string): ResumeData {
  const { layout, lines } = readFrontMatter(markdown.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()));
  let index = lines.findIndex(Boolean);
  if (index < 0) return fitToLimits({ basics: { fullName: "" }, sections: [], layout });

  // Name: the first "# " heading if it comes first, otherwise the first line
  const h1 = HEADING.exec(lines[index]);
  const fullName = plainTitle(h1 ? h1[2] : lines[index]);
  index++;

  // Header: the lines right after the name, up to the first heading, bullet or blank line after them
  const contact: Contact = { email: "", phone: "", location: "", links: [] };
  const headline: string[] = [];
  while (index < lines.length && !lines[index]) index++;
  for (let count = 0; index < lines.length && count < 6; count++) {
    const line = lines[index];
    if (!line || HEADING.test(line) || BULLET.test(line)) break;
    const parts = splitParts(line);
    const leftovers = parts.filter((p) => !readContact(p, contact));
    const hadContact = leftovers.length < parts.length;
    const looksLikeHeadline = !hadContact && count === 0 && line.length <= 120 && !/[.!?]$/.test(line);
    if (!hadContact && !looksLikeHeadline) break; // a paragraph: leave it for the body
    if (hadContact) {
      if (leftovers.length) contact.location ||= leftovers.map(unwrap).join(", ");
    } else {
      headline.push(leftovers.map(unwrap).join(" | "));
    }
    index++;
  }

  const sections: ResumeSection[] = [];
  let section: ResumeSection | null = null;
  let entry: ResumeEntry | null = null;
  let paragraph: string[] = [];

  const ensureSection = (): ResumeSection => {
    if (!section) {
      section = { type: "text", title: "Profile", content: "" };
      sections.push(section);
    }
    return section;
  };

  const flush = () => {
    if (!paragraph.length) return;
    const content = paragraph.join(" ").trim();
    paragraph = [];
    const s = ensureSection();
    if (entry) entry.description = [entry.description, content].filter(Boolean).join("\n\n");
    else if (s.type === "text") s.content = [s.content, content].filter(Boolean).join("\n\n");
    else if (s.type === "skills") s.groups = [...(s.groups ?? []), ...skillGroupFrom(content)];
    else if (s.type === "entries" && !(s.entries ?? []).length) {
      // A section with only text: show it as a paragraph
      s.type = "text";
      s.content = content;
    } else s.items = [...(s.items ?? []), { text: content }];
  };

  for (const line of lines.slice(index)) {
    const heading = HEADING.exec(line);

    if (heading) {
      flush();
      const title = plainTitle(heading[2]);
      if (heading[1].length <= 2 || !section) {
        const type = sectionTypeFor(title);
        section = { type, title, ...(type === "text" ? { content: "" } : {}) };
        sections.push(section);
        entry = null;
        if (heading[1].length <= 2) continue;
      }
      // "### Entry": turn the section into an entries section if needed (keeping what's there)
      const s = ensureSection();
      if (s.type !== "entries") {
        const kept: ResumeEntry[] = s.type === "text" && s.content ? [{ title: s.title, description: s.content }] : [];
        s.type = "entries";
        s.entries = kept.concat((s.items ?? []).map((i) => ({ title: i.text })));
        delete s.content;
        delete s.items;
        delete s.groups;
      }
      const [entryTitle, ...rest] = title.split(/\s+[—–|-]\s+|\s+@\s+|\s+at\s+/);
      entry = { title: entryTitle.trim(), subtitle: rest.join(" · ").trim() || null, bullets: [] };
      s.entries = [...(s.entries ?? []), entry];
      continue;
    }

    if (!line) {
      flush();
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      const value = bullet[1].trim();
      const s = ensureSection();
      if (s.type === "skills") s.groups = [...(s.groups ?? []), ...skillGroupFrom(value)];
      else if (entry) entry.bullets = [...(entry.bullets ?? []), value];
      else if (s.type === "text" && !s.content) {
        s.type = "list";
        s.items = [{ text: value }];
        delete s.content;
      } else if (s.type === "text") paragraph.push(value);
      else if (s.type === "entries" && !(s.entries ?? []).length) {
        // Bullets straight under a section with no entries: a bullet list
        s.type = "list";
        s.items = [{ text: value }];
      } else if (s.type === "entries") s.entries = [...(s.entries ?? []), { title: value }];
      else s.items = [...(s.items ?? []), { text: value }];
      continue;
    }

    if (entry) {
      const dates = !entry.startDate && !entry.endDate && !entry.current ? dateLine(line) : null;
      if (dates) {
        flush();
        entry.startDate = dates.start;
        entry.endDate = dates.end;
        entry.current = dates.current;
        const notes: string[] = [];
        for (const part of dates.rest) {
          if (!part.includes(":") && !entry.location) entry.location = part;
          else notes.push(part);
        }
        if (notes.length) entry.description = [entry.description, notes.join(" · ")].filter(Boolean).join("\n");
        continue;
      }
      // The first short line under an entry is its company, school or tech stack
      const short = line.length <= 150 && !/[.!?]$/.test(unwrap(line));
      if (short && !entry.subtitle && !entry.description && !entry.bullets?.length && !paragraph.length) {
        entry.subtitle = plainTitle(line);
        continue;
      }
    }
    paragraph.push(line);
  }
  flush();

  // One unnamed skills group per section reads better than many
  for (const s of sections as ResumeSection[]) {
    if (s.type !== "skills" || !s.groups) continue;
    const named = s.groups.filter((g) => g.name);
    const unnamed = s.groups.filter((g) => !g.name).flatMap((g) => g.keywords ?? []);
    s.groups = unnamed.length ? [...named, { keywords: unnamed }] : named;
  }

  return fitToLimits({
    basics: { fullName, headline: headline.join(" | "), ...contact },
    sections: sections.filter((s) => s.content || s.items?.length || s.entries?.length || s.groups?.length),
    layout,
  });
}

/** "**Languages:** Java, Go" or "Languages: Java, Go" → named group; "Java, Go" → keywords. */
function skillGroupFrom(text: string): ResumeSkillGroup[] {
  const plain = text.replace(/\*\*|__/g, "").trim();
  const named = /^([^:]{1,60}):\s*(.+)$/.exec(plain);
  return named ? [{ name: named[1].trim(), keywords: splitKeywords(named[2]) }] : [{ keywords: splitKeywords(plain) }];
}

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
