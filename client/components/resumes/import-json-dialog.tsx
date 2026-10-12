"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, Copy } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { getResumeSchema, type ResumeData } from "@/lib/api/resumes";
import { compileResumeInput } from "@/lib/resumes/compile";
import { describeField } from "@/lib/resumes/editor";
import { useProposeResumeVersion } from "@/lib/resumes/use-resumes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SectionMessage } from "@/components/ui/section-message";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 200_000;

type ImportJsonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "ai" adds a ready-made prompt for ChatGPT or Claude above the paste box. */
  mode: "import" | "ai";
  /** Saved resumes can keep the JSON as a suggestion to review; new ones can only replace the editor. */
  resumeId: string | null;
  /** The editor's current content, put into the AI prompt. */
  current: ResumeData;
  onReplace: (data: ResumeData) => void;
  onProposed: () => void;
};

/** Paste resume JSON (yours or an AI's). The server validates it and converts the original format. */
export function ImportJsonDialog({ open, onOpenChange, ...props }: ImportJsonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && <ImportForm {...props} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ mode, resumeId, current, onReplace, onProposed, onDone }: Omit<ImportJsonDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const { getToken } = useAuth();
  const propose = useProposeResumeVersion(resumeId ?? "none");
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"json" | "markdown">("json");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<[string, string][]>([]);
  const [checking, setChecking] = useState<"replace" | "suggest" | null>(null);

  async function submit(action: "replace" | "suggest") {
    setError(null);
    setFieldErrors([]);
    if (text.length > MAX_CHARS) {
      setError("That's too much text for one resume.");
      return;
    }
    setChecking(action);
    try {
      // Any input is accepted for now: JSON in any shape, Markdown or plain text (see lib/resumes/convert.ts)
      const { data } = await compileResumeInput(text, await getToken(), format === "markdown" ? "markdown" : "auto");
      if (action === "replace") {
        onReplace(data);
        onDone();
      } else {
        await propose.mutateAsync({ source: mode === "ai" ? "AI" : "IMPORT", data });
        onProposed();
        onDone();
      }
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setError("Some values couldn't be used:");
        setFieldErrors(Object.entries(e.fieldErrors));
      } else {
        setError(e instanceof ApiError ? e.message : "Unexpected error.");
      }
    } finally {
      setChecking(null);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(resumeId ? "suggest" : "replace"); }} noValidate className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>{mode === "ai" ? "Improve with ChatGPT or Claude" : "Import resume"}</DialogTitle>
        <DialogDescription>
          {mode === "ai"
            ? "Copy the prompt into your AI assistant, add the job description, then paste its reply here."
            : "Paste resume JSON or Markdown. Headings and bullet lists are converted into the resume layout."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4 py-4">
        {mode === "ai" && <PromptStep current={current} />}
        {mode === "import" && <div className="flex gap-2" role="group" aria-label="Import format">
          <Button type="button" size="compact" variant="subtle" isSelected={format === "json"} onClick={() => setFormat("json")}>JSON</Button>
          <Button type="button" size="compact" variant="subtle" isSelected={format === "markdown"} onClick={() => setFormat("markdown")}>Markdown</Button>
        </div>}
        <Field htmlFor="resume-json" label={mode === "ai" ? "2. Paste the AI's reply" : format === "json" ? "JSON" : "Markdown"}
          hint={resumeId ? "Nothing changes until you review and accept the suggestion." : undefined}>
          <Textarea
            id="resume-json"
            rows={mode === "ai" ? 8 : 14}
            className="font-mono text-xs"
            spellCheck={false}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); setFieldErrors([]); }}
            aria-invalid={!!error}
            placeholder={format === "json" ? '{\n  "schemaVersion": 2,\n  "basics": { "fullName": "Your Name" },\n  "sections": []\n}' : "# Alex Morgan\nSoftware Engineer · alex@example.com · San Francisco, CA\n\n## Summary\nProduct-minded engineer...\n\n## Experience\n### Senior Engineer — Acme\n2022–Present\n- Built...\n\n## Skills\n- TypeScript\n- React"}
          />
        </Field>
        {error && (
          <SectionMessage appearance="error" title={error}>
            {fieldErrors.length > 0 && (
              <ul className="flex list-disc flex-col gap-0.5 pl-4">
                {fieldErrors.slice(0, 8).map(([path, message]) => (
                  <li key={path}>{describeField(path)}: {message}</li>
                ))}
              </ul>
            )}
          </SectionMessage>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="subtle">Cancel</Button>
        </DialogClose>
        {resumeId ? (
          <>
            <Button disabled={!text.trim() || !!checking} isLoading={checking === "replace"} onClick={() => submit("replace")}>
              Replace in editor
            </Button>
            <Button type="submit" variant="primary" disabled={!text.trim() || !!checking} isLoading={checking === "suggest"}>
              Add as suggestion
            </Button>
          </>
        ) : (
          <Button type="submit" variant="primary" disabled={!text.trim() || !!checking} isLoading={checking === "replace"}>
            Replace in editor
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

/** Instructions + JSON Schema + current resume, ready to paste into an AI chat. */
function PromptStep({ current }: { current: ResumeData }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");

  async function copy() {
    setState("copying");
    try {
      const schema = await getResumeSchema(await getToken());
      await navigator.clipboard.writeText(buildPrompt(schema, current));
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border p-3">
      <p className="text-sm font-semibold">1. Copy the prompt</p>
      <p className="text-sm text-subtle">
        It includes your current resume and the format rules. Paste it into ChatGPT or Claude, followed by the job
        description. The AI is told not to invent experience — still check every change before accepting it.
      </p>
      <Button className="self-start" size="compact" isLoading={state === "copying"} onClick={copy}>
        {state === "copied" ? <Check /> : <Copy />} {state === "copied" ? "Copied" : "Copy prompt"}
      </Button>
      {state === "failed" && <p className="text-xs text-danger-text" role="alert">Couldn&apos;t copy. Try again.</p>}
    </div>
  );
}

function buildPrompt(schema: string, current: ResumeData) {
  return [
    "You are helping me tailor my resume to a job. I'll paste the job description after this message.",
    "",
    "Rules:",
    "- Reply with ONLY one JSON object that follows the JSON Schema below. No explanations, no code fences.",
    "- Keep every section and entry \"id\" that already exists so I can review the changes. New items may omit ids.",
    "- Never invent jobs, degrees, dates, numbers or skills I don't have. Rephrase, reorder, shorten or hide (\"visible\": false) instead.",
    "- You may add, rename, reorder or hide sections. Formatting allowed in text: **bold**, *italic*, [label](https://…).",
    "- Keep it to one page when possible.",
    "",
    "JSON Schema:",
    schema.trim(),
    "",
    "My current resume:",
    JSON.stringify(current, null, 2),
    "",
    "Job description:",
    "",
  ].join("\n");
}
