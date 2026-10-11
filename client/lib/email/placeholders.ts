/**
 * Client-side mirror of the server's placeholder scan (MergeFields.java), for instant feedback while typing.
 * The server re-checks everything and refuses to save or send on its own; this only drives the UI.
 * Template text is only ever searched, never evaluated.
 */
const PLACEHOLDER = /\{\{([^{}\r\n]{0,64})\}\}/g;

/** Every placeholder-like fragment in the text, including leftover "{{" or "}}". Sending is blocked while any remain. */
export function findPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) found.add(match[0]);
  const rest = text.replace(PLACEHOLDER, "");
  if (rest.includes("{{")) found.add("{{");
  if (rest.includes("}}")) found.add("}}");
  return [...found];
}

/** Placeholders that aren't on the allowlist (or are malformed). A template containing any can't be saved. */
export function findUnknownPlaceholders(text: string, allowedKeys: ReadonlySet<string>): string[] {
  return findPlaceholders(text).filter((placeholder) => {
    if (!placeholder.startsWith("{{") || !placeholder.endsWith("}}") || placeholder.length < 4) return true;
    return !allowedKeys.has(placeholder.slice(2, -2).trim());
  });
}

/** Same rules as the server (ApplicationEmailDtos.EMAIL_ADDRESS): one plain address, no names or lists. */
const EMAIL_ADDRESS = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,63}$/;

export function isValidEmailAddress(value: string) {
  return value.length <= 254 && EMAIL_ADDRESS.test(value);
}

/**
 * Inserts `text` into a controlled input/textarea at the cursor (replacing any selection) and returns the
 * new value plus where the cursor should go afterwards.
 */
export function insertAtCursor(
  value: string,
  text: string,
  selection: { start: number; end: number } | null,
): { value: string; cursor: number } {
  const start = selection?.start ?? value.length;
  const end = selection?.end ?? value.length;
  return { value: value.slice(0, start) + text + value.slice(end), cursor: start + text.length };
}
