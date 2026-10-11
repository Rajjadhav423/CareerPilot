"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Play } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { normalizeResumeJson, type ResumeData } from "@/lib/api/resumes";
import { describeField } from "@/lib/resumes/editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionMessage } from "@/components/ui/section-message";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 200_000;

type JsonEditorPanelProps = {
  /** The editor's current content; the text box starts with it. */
  value: ResumeData;
  /** Called with the validated, normalized resume after "Compile". */
  onCompile: (data: ResumeData) => void;
};

/**
 * Edit the resume as JSON: paste or type, press Compile, and the server validates it (both formats accepted)
 * and the preview updates. Mounted fresh each time the JSON view opens, so it always starts from the form's content.
 */
export function JsonEditorPanel({ value, onCompile }: JsonEditorPanelProps) {
  const { getToken } = useAuth();
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<[string, string][]>([]);
  const [compiled, setCompiled] = useState(false);

  async function compile() {
    setError(null);
    setFieldErrors([]);
    setCompiled(false);
    if (text.length > MAX_CHARS) {
      setError("That's too much text for one resume.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(text));
    } catch (e) {
      setError(`That isn't valid JSON${e instanceof SyntaxError ? `: ${e.message}` : "."}`);
      return;
    }
    setCompiling(true);
    try {
      const data = await normalizeResumeJson(parsed, await getToken());
      onCompile(data);
      setText(JSON.stringify(data, null, 2));
      setCompiled(true);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setError("Fix these fields:");
        setFieldErrors(Object.entries(e.fieldErrors));
      } else {
        setError(e instanceof ApiError ? e.message : "Unexpected error.");
      }
    } finally {
      setCompiling(false);
    }
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Resume JSON</h2>
          <p className="text-xs text-subtlest">Paste JSON (from ChatGPT, Claude or Export JSON), then press Compile.</p>
        </div>
        <Button variant="primary" isLoading={compiling} disabled={!text.trim()} onClick={compile}>
          <Play /> Compile
        </Button>
      </div>
      <label htmlFor="resume-json-editor" className="sr-only">Resume JSON</label>
      <Textarea
        id="resume-json-editor"
        rows={28}
        className="font-mono text-xs"
        spellCheck={false}
        value={text}
        onChange={(e) => { setText(e.target.value); setCompiled(false); }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            compile();
          }
        }}
        aria-invalid={!!error}
      />
      <p className="text-xs text-subtlest">Ctrl + Enter also compiles. Remember to Save afterwards.</p>
      {compiled && !error && (
        <SectionMessage appearance="success" title="Compiled">The preview and the form now show this JSON.</SectionMessage>
      )}
      {error && (
        <SectionMessage appearance="error" title={error}>
          {fieldErrors.length > 0 && (
            <ul className="flex list-disc flex-col gap-0.5 pl-4">
              {fieldErrors.slice(0, 10).map(([path, message]) => (
                <li key={path}>{describeField(path)}: {message}</li>
              ))}
            </ul>
          )}
        </SectionMessage>
      )}
    </Card>
  );
}

/** AI replies often wrap the JSON in ``` fences or add a sentence; keep the outermost object. */
function extractJson(text: string) {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}
