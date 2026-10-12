import { ApiError } from "@/lib/api/client";
import { normalizeResumeJson, type ResumeData } from "@/lib/api/resumes";
import { fromAnyJson, parseLooseJson } from "./convert";

export type CompileResult = {
  data: ResumeData;
  /** How the input was read, shown to the user. */
  readAs: "resume-json" | "other-json";
};

/**
 * Turns pasted JSON into a resume. CareerPilot JSON (current or original format) goes to the server unchanged;
 * if the server rejects it, or it's some other JSON, it's mapped leniently. The server still validates and
 * cleans the final result.
 */
export async function compileResumeInput(text: string, token: string | null): Promise<CompileResult> {
  const parsed = parseLooseJson(text);
  if (parsed === undefined) {
    throw new ApiError("That isn't valid JSON. Check for a missing comma or quote, or copy the whole reply again.", 400);
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
