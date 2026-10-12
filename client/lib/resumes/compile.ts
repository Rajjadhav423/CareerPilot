import { ApiError } from "@/lib/api/client";
import { normalizeResumeJson, type ResumeData } from "@/lib/api/resumes";
import { fromAnyJson, fromMarkdown, parseLooseJson } from "./convert";

export type CompileResult = {
  data: ResumeData;
  /** How the input was read, shown to the user. */
  readAs: "resume-json" | "other-json" | "text";
};

/**
 * Turns whatever the user pasted into a resume. CareerPilot JSON (current or original format) goes to the server
 * unchanged; if the server rejects it, or it's some other JSON, it's mapped leniently; anything that isn't JSON
 * is read as Markdown / plain text. The server still validates and cleans the final result.
 */
export async function compileResumeInput(text: string, token: string | null, format: "auto" | "markdown" = "auto"): Promise<CompileResult> {
  const parsed = format === "markdown" ? undefined : parseLooseJson(text);
  if (parsed === undefined) {
    return { data: await normalizeResumeJson(fromMarkdown(text), token), readAs: "text" };
  }
  const isObject = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  if (isObject && ("basics" in parsed || "data" in parsed)) {
    try {
      return { data: await normalizeResumeJson(parsed, token), readAs: "resume-json" };
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 400) throw e;
    }
  }
  return { data: await normalizeResumeJson(fromAnyJson(parsed), token), readAs: "other-json" };
}
