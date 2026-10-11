import type {
  ResumeData,
  ResumeEntry,
  ResumeListItem,
  ResumeSection,
  ResumeSkillGroup,
  SectionType,
} from "@/lib/api/resumes";

/** Editor model: the same shape as the API, with every list and field present. */
export type EditableEntry = Required<Omit<ResumeEntry, "current" | "visible">> & { current: boolean; visible: boolean };
export type EditableItem = { id: string; text: string; visible: boolean };
export type EditableGroup = { id: string; name: string; keywords: string[]; visible: boolean };
export type EditableSection = {
  id: string;
  type: SectionType;
  title: string;
  visible: boolean;
  entries: EditableEntry[];
  content: string;
  items: EditableItem[];
  groups: EditableGroup[];
};
export type EditableResume = {
  basics: {
    fullName: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    links: { label: string; url: string }[];
  };
  sections: EditableSection[];
};

/** Short random id (letters/digits), valid for the API's id pattern. */
export function newId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(36).padStart(2, "0")).join("")
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export const emptyEntry = (): EditableEntry => ({
  id: newId("e"), title: "", subtitle: "", location: "", startDate: "", endDate: "", current: false, url: "",
  description: "", bullets: [], visible: true,
});
export const emptyGroup = (): EditableGroup => ({ id: newId("g"), name: "", keywords: [], visible: true });

export function newSection(type: SectionType, title: string): EditableSection {
  return {
    id: newId("s"),
    type,
    title,
    visible: true,
    entries: type === "entries" ? [emptyEntry()] : [],
    content: "",
    items: [],
    groups: type === "skills" ? [emptyGroup()] : [],
  };
}

/** Ready-made sections for the "Add section" menu. Every title can be renamed afterwards. */
export const SECTION_PRESETS: { title: string; type: SectionType; hint: string }[] = [
  { title: "Summary", type: "text", hint: "A short introduction" },
  { title: "Experience", type: "entries", hint: "Jobs and internships" },
  { title: "Education", type: "entries", hint: "Degrees and schools" },
  { title: "Projects", type: "entries", hint: "Things you built" },
  { title: "Skills", type: "skills", hint: "Grouped keywords" },
  { title: "Certifications", type: "entries", hint: "Courses and certificates" },
  { title: "Volunteering", type: "entries", hint: "Community work" },
  { title: "Awards", type: "list", hint: "Honours and prizes" },
  { title: "Publications", type: "list", hint: "Papers and articles" },
  { title: "Languages", type: "list", hint: "Spoken languages" },
  { title: "Interests", type: "list", hint: "Hobbies" },
];

export const SECTION_TYPES: { type: SectionType; label: string; hint: string }[] = [
  { type: "entries", label: "Entries", hint: "Title, place, dates and bullet points" },
  { type: "text", label: "Paragraph", hint: "Free text" },
  { type: "list", label: "Bullet list", hint: "One point per line" },
  { type: "skills", label: "Skills", hint: "Named groups of keywords" },
];

export function emptyResume(): EditableResume {
  return {
    basics: { fullName: "", headline: "", email: "", phone: "", location: "", links: [] },
    sections: [
      newSection("text", "Summary"),
      newSection("entries", "Experience"),
      newSection("entries", "Education"),
      newSection("skills", "Skills"),
    ],
  };
}

const text = (value: string | null | undefined) => value ?? "";
const visible = (value: boolean | null | undefined) => value !== false;

/** Fills in missing fields from saved or imported JSON (already in the current format). */
export function toEditable(data: ResumeData): EditableResume {
  return {
    basics: {
      fullName: text(data.basics?.fullName),
      headline: text(data.basics?.headline),
      email: text(data.basics?.email),
      phone: text(data.basics?.phone),
      location: text(data.basics?.location),
      links: (data.basics?.links ?? []).map((l) => ({ label: text(l.label), url: text(l.url) })),
    },
    sections: (data.sections ?? []).map((s: ResumeSection) => ({
      id: s.id ?? newId("s"),
      type: s.type,
      title: text(s.title),
      visible: visible(s.visible),
      entries: (s.entries ?? []).map((e: ResumeEntry) => ({
        id: e.id ?? newId("e"), title: text(e.title), subtitle: text(e.subtitle), location: text(e.location),
        startDate: text(e.startDate), endDate: text(e.endDate), current: !!e.current, url: text(e.url),
        description: text(e.description), bullets: e.bullets ?? [], visible: visible(e.visible),
      })),
      content: text(s.content),
      items: (s.items ?? []).map((i: ResumeListItem) => ({ id: i.id ?? newId("i"), text: text(i.text), visible: visible(i.visible) })),
      groups: (s.groups ?? []).map((g: ResumeSkillGroup) => ({
        id: g.id ?? newId("g"), name: text(g.name), keywords: g.keywords ?? [], visible: visible(g.visible),
      })),
    })),
  };
}

const blank = (value: string) => value.trim() === "";
const opt = (value: string) => (blank(value) ? null : value.trim());
const lines = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);
const entryIsEmpty = (e: EditableEntry) =>
  [e.title, e.subtitle, e.location, e.startDate, e.endDate, e.url, e.description].every((v) => blank(v ?? "")) &&
  lines(e.bullets).length === 0;

/**
 * What the API receives: trimmed text, optional blanks as null, completely empty entries and items dropped.
 * Only the field for each section's type is sent.
 */
export function toApi(resume: EditableResume): ResumeData {
  return {
    schemaVersion: 2,
    basics: {
      fullName: resume.basics.fullName.trim(),
      headline: opt(resume.basics.headline),
      email: opt(resume.basics.email),
      phone: opt(resume.basics.phone),
      location: opt(resume.basics.location),
      links: resume.basics.links.filter((l) => !blank(l.url)).map((l) => ({ label: opt(l.label), url: l.url.trim() })),
    },
    sections: resume.sections.map((s) => {
      const base = { id: s.id, type: s.type, title: s.title.trim() || "Untitled section", visible: s.visible };
      switch (s.type) {
        case "entries":
          return {
            ...base,
            entries: s.entries.filter((e) => !entryIsEmpty(e)).map((e) => ({
              id: e.id, title: e.title.trim(), subtitle: opt(e.subtitle ?? ""), location: opt(e.location ?? ""),
              startDate: opt(e.startDate ?? ""), endDate: e.current ? null : opt(e.endDate ?? ""), current: e.current,
              url: opt(e.url ?? ""), description: opt(e.description ?? ""), bullets: lines(e.bullets), visible: e.visible,
            })),
          };
        case "text":
          return { ...base, content: opt(s.content) };
        case "list":
          return { ...base, items: s.items.filter((i) => !blank(i.text)).map((i) => ({ id: i.id, text: i.text.trim(), visible: i.visible })) };
        case "skills":
          return {
            ...base,
            groups: s.groups
              .filter((g) => !blank(g.name) || lines(g.keywords).length > 0)
              .map((g) => ({ id: g.id, name: opt(g.name), keywords: lines(g.keywords), visible: g.visible })),
          };
      }
    }),
  };
}

/** "data.sections[1].entries[0].title" → "Experience › Entry 1 › title" for error lists. */
export function describeField(path: string, resume?: EditableResume) {
  const section = /sections\[(\d+)\]/.exec(path);
  const sectionTitle = section ? resume?.sections[Number(section[1])]?.title || `Section ${Number(section[1]) + 1}` : null;
  const rest = path
    .replace(/^data\./, "")
    .replace(/^sections\[\d+\]\.?/, "")
    .replace(/entries\[(\d+)\]/, (_, i) => `Entry ${Number(i) + 1}`)
    .replace(/items\[(\d+)\]/, (_, i) => `Item ${Number(i) + 1}`)
    .replace(/groups\[(\d+)\]/, (_, i) => `Group ${Number(i) + 1}`)
    .replace(/links\[(\d+)\]/, (_, i) => `Link ${Number(i) + 1}`)
    .replace(/^basics\./, "Basics › ")
    .split(".")
    .filter(Boolean)
    .join(" › ");
  return [sectionTitle, rest].filter(Boolean).join(" › ");
}

/** A random id for idempotent uploads. crypto.randomUUID needs a secure context (https or localhost). */
export function newRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
