"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Play } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { ResumeData } from "@/lib/api/resumes";
import { compileResumeInput } from "@/lib/resumes/compile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionMessage } from "@/components/ui/section-message";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 200_000;

const PLACEHOLDER = `# Your Name
Software Engineer · your@email.com · City, Country

## Summary
Engineer with 5+ years of experience building…

## Experience
### Senior Software Engineer — Acme Corp
Jan 2022 – Present · Remote
- Built a caching layer that cut API latency by **40%**
- Led a team of 4 engineers

## Education
### B.Tech Computer Science — IIT Bombay
2015 – 2019

## Skills
- Languages: Java, TypeScript
- PostgreSQL, Redis, Kafka`;

const GUIDE: [string, string][] = [
  ["---\nmargin: 12mm 16mm\n---", "Page margins, at the very top (top/bottom left/right; or margin-top: 10mm; also cm, in, pt)"],
  ["# Your Name", "Name (else the first line)"],
  ["email · phone · City", "Contact line"],
  ["## Experience", "Section"],
  ["### Job Title — Company", "Entry"],
  ["Jan 2022 – Present · Remote", "Dates and location"],
  ["- Bullet point", "Point"],
  ["- Languages: Java, Go", "Named skill group"],
  ["**bold**, *italic*, [text](https://…)", "Formatting"],
];

type MarkdownEditorPanelProps = {
  /** The text box content; kept by the editor so it survives switching tabs. */
  value: string;
  onChange: (text: string) => void;
  onApply: (data: ResumeData) => void;
};

/** Write or paste a resume as Markdown or plain text; Apply converts it. No format is rejected. */
export function MarkdownEditorPanel({ value, onChange, onApply }: MarkdownEditorPanelProps) {
  const { getToken } = useAuth();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setError(null);
    setApplied(false);
    if (value.length > MAX_CHARS) {
      setError("That's too much text for one resume.");
      return;
    }
    setApplying(true);
    try {
      onApply((await compileResumeInput(value, await getToken(), "markdown")).data);
      setApplied(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unexpected error.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Markdown</h2>
          <p className="text-xs text-subtlest">Write or paste any text, then press Apply. It replaces the form&apos;s content.</p>
        </div>
        <Button variant="primary" isLoading={applying} disabled={!value.trim()} onClick={apply}>
          <Play /> Apply
        </Button>
      </div>

      <details className="rounded-sm border border-border text-xs">
        <summary className="cursor-pointer px-3 py-2 font-medium select-none hover:bg-neutral-subtle-hovered">
          Format guide (optional)
        </summary>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 px-3 py-2 @lg:grid-cols-2">
          {GUIDE.map(([syntax, meaning]) => (
            <div key={syntax} className="contents">
              <dt className="font-mono whitespace-pre-wrap wrap-break-word text-subtle">{syntax}</dt>
              <dd className="mb-1 text-subtlest @lg:mb-0">{meaning}</dd>
            </div>
          ))}
        </dl>
      </details>

      <label htmlFor="resume-markdown-editor" className="sr-only">Resume Markdown</label>
      <Textarea
        id="resume-markdown-editor"
        rows={28}
        className="font-mono text-xs"
        spellCheck={false}
        placeholder={PLACEHOLDER}
        value={value}
        onChange={(e) => { onChange(e.target.value); setApplied(false); }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
      />
      <p className="text-xs text-subtlest">Ctrl + Enter also applies. Remember to Save afterwards.</p>
      {applied && !error && (
        <SectionMessage appearance="success" title="Applied">The preview and the form now show this text.</SectionMessage>
      )}
      {error && <SectionMessage appearance="error" title="Couldn't apply">{error}</SectionMessage>}
    </Card>
  );
}
