/*
 * Reads a scraped job page with an LLM on Groq (free tier) and returns clean job details plus the HR / recruiter
 * email when the post has one. Server only: GROQ_API_KEY never reaches the browser.
 *
 * The model only sees text from the page and is told never to invent anything. Its answer is checked again here:
 * emails must literally appear in the page text, so a made-up address is dropped.
 */

export type ExtractedJob = {
  title: string;
  company: string;
  location: string;
  workMode: "ONSITE" | "HYBRID" | "REMOTE" | "";
  description: string;
  hrEmail: string;
};

const EMAIL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24}/g;
/** Addresses that never belong to a person you can apply to */
const NOT_A_CONTACT = /^(no-?reply|do-?not-?reply|notifications?|privacy|abuse|support|feedback|info@linkedin)/i;

/** Every contact email in the text, in order, without duplicates or system addresses. */
export function findEmails(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(EMAIL)) {
    const email = match[0].replace(/\.+$/, "").toLowerCase();
    if (!NOT_A_CONTACT.test(email) && !email.endsWith("@linkedin.com") && !email.endsWith(".png") && !email.endsWith(".jpg")) {
      seen.add(email);
    }
  }
  return [...seen];
}

/** Visible text of an HTML page: scripts, styles and tags removed, whitespace tidied. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

const SYSTEM_PROMPT = `You extract job details from the text of a job posting or a social media post about a job.
Reply with ONLY a JSON object with exactly these keys:
{"title": string, "company": string, "location": string, "workMode": "ONSITE" | "HYBRID" | "REMOTE" | "",
 "description": string, "hrEmail": string}
Rules:
- Use only information in the text. Never invent anything. Use "" when something isn't stated.
- title: the role, e.g. "React.js & Java Developer Intern". No company name or emojis in it.
- company: the hiring company. If a person hires for their own project, use their name.
- location: city/country as written, or "Remote" when it's remote only.
- workMode: REMOTE, HYBRID or ONSITE only when the text says so, otherwise "".
- description: the posting's own text about the role, cleaned up: keep responsibilities, requirements, stipend or
  salary, and how to apply; drop hashtags, emojis, "like and share" lines and unrelated feed text. Plain text with
  line breaks, at most 4000 characters.
- hrEmail: the email address to send an application or resume to, exactly as written in the text, else "".`;

/** Extracts the job with Groq. Returns null when no key is set or the call fails (callers fall back). */
export async function extractWithAi(text: string, hints: Partial<ExtractedJob>): Promise<ExtractedJob | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const input = [
    hints.title ? `Page title: ${hints.title}` : "",
    hints.company ? `Site/company hint: ${hints.company}` : "",
    "Page text:",
    text.slice(0, 14_000),
  ].filter(Boolean).join("\n");

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    // Status only: the page text could contain personal data
    console.warn(`Groq extraction failed with status ${response.status}`);
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
  } catch {
    return null;
  }

  const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const workMode = str(parsed.workMode, 10).toUpperCase();
  // The email must be in the page: anything else is a guess
  const emails = findEmails(text);
  const aiEmail = str(parsed.hrEmail, 254).toLowerCase();
  return {
    title: str(parsed.title, 200),
    company: str(parsed.company, 200),
    location: str(parsed.location, 200),
    workMode: workMode === "ONSITE" || workMode === "HYBRID" || workMode === "REMOTE" ? workMode : "",
    description: str(parsed.description, 20_000),
    hrEmail: emails.includes(aiEmail) ? aiEmail : (emails[0] ?? ""),
  };
}
