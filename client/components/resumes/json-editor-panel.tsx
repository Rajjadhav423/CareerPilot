"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Play } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { ResumeData } from "@/lib/api/resumes";
import { compileResumeInput, type CompileResult } from "@/lib/resumes/compile";
import { describeField } from "@/lib/resumes/editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionMessage } from "@/components/ui/section-message";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 200_000;

const READ_AS: Record<CompileResult["readAs"], string> = {
  "resume-json": "The preview and the form now show this JSON.",
  "other-json": "This JSON wasn't in CareerPilot's format, so its fields were mapped to sections. Check the preview.",
  text: "This wasn't JSON, so it was read as text (headings → sections, bullets → points). Check the preview.",
};

type JsonEditorPanelProps = {
  /** The text box content; kept by the editor so it survives switching tabs. */
  value: string;
  onChange: (text: string) => void;
  /** Called with the normalized resume after "Compile". */
  onCompile: (data: ResumeData) => void;
};

/** Edit the resume as JSON. Any JSON is accepted for now; it's converted as well as possible. */
export function JsonEditorPanel({ value, onChange, onCompile }: JsonEditorPanelProps) {
  const { getToken } = useAuth();
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<[string, string][]>([]);
  const [result, setResult] = useState<CompileResult["readAs"] | null>(null);

  async function compile() {
    setError(null);
    setFieldErrors([]);
    setResult(null);
    if (value.length > MAX_CHARS) {
      setError("That's too much text for one resume.");
      return;
    }
    setCompiling(true);
    try {
      const compiled = await compileResumeInput(value, await getToken());
      onCompile(compiled.data);
      setResult(compiled.readAs);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setError("Some values couldn't be used:");
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
          <p className="text-xs text-subtlest">Paste any JSON (CareerPilot, JSON Resume, an AI reply…), then press Compile.</p>
        </div>
        <Button variant="primary" isLoading={compiling} disabled={!value.trim()} onClick={compile}>
          <Play /> Compile
        </Button>
      </div>
      <label htmlFor="resume-json-editor" className="sr-only">Resume JSON</label>
      <Textarea
        id="resume-json-editor"
        rows={28}
        className="font-mono text-xs"
        spellCheck={false}
        value={value}
        onChange={(e) => { onChange(e.target.value); setResult(null); }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            compile();
          }
        }}
        aria-invalid={!!error}
      />
      <p className="text-xs text-subtlest">Ctrl + Enter also compiles. Remember to Save afterwards.</p>
      {result && !error && <SectionMessage appearance="success" title="Compiled">{READ_AS[result]}</SectionMessage>}
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
