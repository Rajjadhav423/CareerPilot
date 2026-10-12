"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { ApiError } from "@/lib/api/client";
import { isDocDocument, type DocDocument } from "@/lib/api/docs";
import type { ResumeData } from "@/lib/api/resumes";
import { compileResumeInput } from "@/lib/resumes/compile";
import { parseLooseJson } from "@/lib/resumes/convert";
import { describeField } from "@/lib/resumes/editor";
import { RESUME_VERSIONS_ENABLED } from "@/lib/resumes/features";
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
  /** Saved resumes can keep the JSON as a suggestion to review; new ones can only replace the editor. */
  resumeId: string | null;
  onReplace: (data: ResumeData) => void;
  /** A docEngine document was pasted (schemaVersion 3): it becomes the resume's document. */
  onReplaceDocument: (document: DocDocument) => void;
  onProposed: () => void;
};

/** Paste a document or resume JSON. The server validates it (and converts the original resume format). */
export function ImportJsonDialog({ open, onOpenChange, ...props }: ImportJsonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && <ImportForm {...props} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ resumeId, onReplace, onReplaceDocument, onProposed, onDone }: Omit<ImportJsonDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const { getToken } = useAuth();
  const propose = useProposeResumeVersion(resumeId ?? "none");
  // Suggestions need version history; without it, imports replace the editor content
  const canSuggest = RESUME_VERSIONS_ENABLED && !!resumeId;
  const [text, setText] = useState("");
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
      // A docEngine document is used as it is (the server checks it with the document rules)
      const json = parseLooseJson(text);
      if (isDocDocument(json)) {
        if (action === "replace") {
          onReplaceDocument(json);
        } else {
          await propose.mutateAsync({ source: "IMPORT", document: json });
          onProposed();
        }
        onDone();
        return;
      }
      // Any other JSON is accepted for now and mapped to the form (see lib/resumes/convert.ts)
      const { data } = await compileResumeInput(text, await getToken());
      if (action === "replace") {
        onReplace(data);
        onDone();
      } else {
        await propose.mutateAsync({ source: "IMPORT", data });
        onProposed();
        onDone();
      }
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setError("Some values couldn't be used:");
        setFieldErrors(Object.entries(e.fieldErrors));
      } else if (e instanceof ApiError && e.issues.length > 0) {
        setError(e.message);
        setFieldErrors(e.issues.map((issue) => [issue.path || "/", issue.message]));
      } else {
        setError(e instanceof ApiError ? e.message : "Unexpected error.");
      }
    } finally {
      setChecking(null);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(canSuggest ? "suggest" : "replace"); }} noValidate className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>Import resume</DialogTitle>
        <DialogDescription>Paste a document (schemaVersion 3) or resume JSON.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4 py-4">
        <Field htmlFor="resume-json" label="JSON"
          hint={canSuggest ? "Nothing changes until you review and accept the suggestion." : "Replaces what's in the editor; press Save to keep it."}>
          <Textarea
            id="resume-json"
            rows={14}
            className="font-mono text-xs"
            spellCheck={false}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); setFieldErrors([]); }}
            aria-invalid={!!error}
            placeholder={'{\n  "schemaVersion": 3,\n  "document": "resume",\n  "sections": []\n}'}
          />
        </Field>
        {error && (
          <SectionMessage appearance="error" title={error}>
            {fieldErrors.length > 0 && (
              <ul className="flex list-disc flex-col gap-0.5 pl-4">
                {fieldErrors.slice(0, 8).map(([path, message], i) => (
                  <li key={`${path}-${i}`}>{path.startsWith("/") ? <code className="text-xs">{path}</code> : describeField(path)}: {message}</li>
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
        {canSuggest ? (
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
