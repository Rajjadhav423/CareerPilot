import { apiFetch } from "@/lib/api/client";

/**
 * A reusable detail (GitHub, LinkedIn, LeetCode, resume link …) saved once in Settings and written as {{key}} in any
 * resume field, document or email template. The server fills it in when a preview, PDF or email is made.
 */
export type UserField = { key: string; label: string; value: string };

const BASE = "/api/v1/me/fields";

export function listUserFields(token: string | null) {
  return apiFetch<UserField[]>(BASE, { token });
}

/** Saves the whole list (replaces what was there). */
export function saveUserFields(fields: UserField[], token: string | null) {
  return apiFetch<UserField[]>(BASE, { method: "PUT", json: { fields }, token });
}

export const placeholderOf = (key: string) => `{{${key}}}`;

/** "LeetCode profile" → "leetcode_profile": a valid key from a label. */
export function keyFromLabel(label: string): string {
  const key = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1");
  return key.slice(0, 40) || "field";
}

/** Common details offered as one-click additions in Settings. */
export const SUGGESTED_FIELDS: { key: string; label: string; example: string }[] = [
  { key: "resume_url", label: "Resume link", example: "https://drive.google.com/file/d/…/view" },
  { key: "github", label: "GitHub", example: "https://github.com/your-username" },
  { key: "linkedin", label: "LinkedIn", example: "https://linkedin.com/in/your-name" },
  { key: "leetcode", label: "LeetCode", example: "https://leetcode.com/u/your-username" },
  { key: "portfolio", label: "Portfolio", example: "https://your-site.dev" },
  { key: "phone", label: "Phone", example: "+91 98765 43210" },
  { key: "location", label: "Location", example: "Pune, India" },
  { key: "email", label: "Email", example: "you@example.com" },
];
