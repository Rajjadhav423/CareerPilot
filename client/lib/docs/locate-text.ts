/**
 * Finds where text selected in the PDF preview is written in the document JSON, like SyncTeX for LaTeX.
 *
 * The PDF shows rendered text, the JSON holds its source: formatting tags (`with <b>8 years</b> of`), entities,
 * escaped quotes and line breaks can sit between the words, and headings may be upper-cased by CSS. So words are
 * matched case-insensitively with any of those allowed between them. Matches inside "text" and "html" values
 * (document content) win over ones in "title" or "meta"; `occurrence` picks the n-th one when the same text appears
 * several times (it is the n-th time in the PDF too).
 */

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Between two words: whitespace, tags, entities or escaped newlines, in any mix. */
const GAP = String.raw`(?:\s|\\n|\\t|<[^>]*>|&[a-zA-Z0-9#]+;)+`;

const CONTENT_KEY = /"(text|html)"\s*:\s*"(?:[^"\\]|\\.)*$/;

export function locateText(source: string, selected: string, occurrence = 0): { start: number; end: number } | null {
  const words = selected.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || selected.trim().length < 2) return null;
  // A quote shows as \" in JSON
  const pattern = words.map((word) => escapeRegex(word).replace(/"/g, '\\\\?"')).join(GAP);
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "gi");
  } catch {
    return null;
  }

  const content: { start: number; end: number }[] = [];
  const other: { start: number; end: number }[] = [];
  for (const match of source.matchAll(regex)) {
    const start = match.index ?? 0;
    const range = { start, end: start + match[0].length };
    // Look back a little for the key whose string value holds the match
    (CONTENT_KEY.test(source.slice(Math.max(0, start - 3000), start)) ? content : other).push(range);
  }
  const preferred = content.length > 0 ? content : other;
  if (preferred.length === 0) return null;
  return preferred[Math.min(occurrence, preferred.length - 1)] ?? null;
}

/** "Rohan Deshpande" in "**Rohan** Deshpande": the form keeps formatting markers, the PDF doesn't. */
export function stripMarkers(value: string): string {
  return value.replace(/\*\*|\*|_/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

const compact = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

/** The form field holding the selected text, and where in its value (when it's written there as is). */
export function locateInFields(
  fields: (HTMLInputElement | HTMLTextAreaElement)[],
  selected: string,
  occurrence = 0,
): { field: HTMLInputElement | HTMLTextAreaElement; start: number; end: number } | null {
  const wanted = compact(selected);
  if (wanted.length < 2) return null;
  const matches = fields.filter((field) => compact(stripMarkers(field.value)).includes(wanted));
  const field = matches[Math.min(occurrence, matches.length - 1)];
  if (!field) return null;
  const at = field.value.toLowerCase().indexOf(selected.trim().toLowerCase());
  return at >= 0
    ? { field, start: at, end: at + selected.trim().length }
    : { field, start: 0, end: field.value.length };
}
