/**
 * Repairs common copy-paste damage in JSON copied from an AI chat, so it can be parsed:
 * ``` code fences, text before/after the object, invalid backslash escapes such as "\@" or "https\://"
 * (added by some chat pages and rich-text editors), and trailing commas.
 * Valid JSON is returned unchanged (apart from fences and surrounding text).
 */
export function repairJson(text: string): string {
  let t = text.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  // Keep valid escapes (\" \\ \/ \b \f \n \r \t \uXXXX); drop a backslash in front of anything else
  t = t.replace(/\\(u[0-9a-fA-F]{4}|["\\/bfnrt])|\\/g, (match, valid: string | undefined) => (valid ? match : ""));
  // Trailing commas before } or ]
  t = t.replace(/,(\s*[}\]])/g, "$1");
  return t;
}

/** Parses JSON, repairing copy-paste damage when needed. Throws the original error if it still fails. */
export function parseJsonLeniently(text: string): { value: unknown; repaired: boolean } {
  try {
    return { value: JSON.parse(text), repaired: false };
  } catch (error) {
    try {
      return { value: JSON.parse(repairJson(text)), repaired: true };
    } catch {
      throw error;
    }
  }
}
