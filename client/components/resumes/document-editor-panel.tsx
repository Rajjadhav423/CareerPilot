"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AlignLeft, BookOpen, Check, Copy, Download, Eraser, FileText, ShieldCheck, Wand2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { getDocumentRules, validateDocument, type DocIssue, type DocValidation } from "@/lib/api/docs";
import { locatePointer } from "@/lib/docs/json-locate";
import { locateText } from "@/lib/docs/locate-text";
import { parseJsonLeniently } from "@/lib/docs/json-repair";
import { SAMPLE_DOCUMENT_TEXT } from "@/lib/docs/sample-document";
import { Button } from "@/components/ui/button";
import { FieldsMenu } from "@/components/settings/fields-menu";
import { Card } from "@/components/ui/card";
import { CodeEditor, type CodeEditorHandle } from "@/components/ui/code-editor";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";

const MAX_CHARS = 500_000;

type DocumentEditorPanelProps = {
  /** The document JSON text; kept by the editor so it survives switching tabs. */
  value: string;
  onChange: (text: string) => void;
  /** Why the text can't be used right now (JSON syntax), shown under the editor. */
  parseError: string | null;
  /** Issues from the last preview render (invalid document). */
  previewIssues: DocIssue[];
  /** Shown above the editor, e.g. that editing turns the resume into a document. */
  notice?: string;
  /** Text selected in the preview: select where it's written in the JSON (a new `id` asks again). */
  reveal?: { text: string; occurrence: number; id: number } | null;
};

/**
 * Edit the resume as a docEngine document: full control over tags, classes, styles, margins and pages.
 * The preview follows every valid change; Check runs the strict rules, Auto-fix repairs what it can.
 */
export function DocumentEditorPanel({
  value, onChange, parseError, previewIssues, notice, reveal,
}: DocumentEditorPanelProps) {
  const { getToken } = useAuth();
  const editor = useRef<CodeEditorHandle>(null);
  const [checking, setChecking] = useState<"strict" | "lenient" | null>(null);
  const [result, setResult] = useState<DocValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  /** Which replacement is waiting for confirmation */
  const [pending, setPending] = useState<"sample" | "clear" | null>(null);

  /** The JSON; Auto-fix and Format also repair copy-paste damage (fences, stray backslashes, trailing commas). */
  function parsed(repair: boolean): unknown | undefined {
    try {
      return repair ? parseJsonLeniently(value).value : JSON.parse(value);
    } catch {
      setError(repair
        ? `${parseError ?? "That isn't valid JSON."} Auto-fix couldn't repair it; check the line it mentions.`
        : `${parseError ?? "That isn't valid JSON."} Press Auto-fix to repair common copy-paste problems.`);
      return undefined;
    }
  }

  async function check(mode: "strict" | "lenient") {
    setError(null);
    setResult(null);
    if (value.length > MAX_CHARS) {
      setError("The document is too large (512 KB at most).");
      return;
    }
    const document = parsed(mode === "lenient");
    if (document === undefined) return;
    setChecking(mode);
    try {
      const validation = await validateDocument(document, mode, await getToken());
      setResult(validation);
      if (mode === "lenient" && validation.document) {
        onChange(JSON.stringify(validation.document, null, 2));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unexpected error.");
    } finally {
      setChecking(null);
    }
  }

  function replaceWith(text: string) {
    onChange(text);
    setResult(null);
    setError(null);
    setPending(null);
    editor.current?.focus();
  }

  /** Loading the sample asks first only when it would replace the user's own text. */
  function loadSample() {
    if (!value.trim() || value === SAMPLE_DOCUMENT_TEXT) replaceWith(SAMPLE_DOCUMENT_TEXT);
    else setPending("sample");
  }

  function format() {
    const document = parsed(true);
    if (document !== undefined) onChange(JSON.stringify(document, null, 2));
  }

  /** Selects the spot an issue points at, so it's easy to find in a long document. */
  function goTo(issue: DocIssue) {
    select(locatePointer(value, issue.path));
  }

  // Text selected in the preview: jump to where it's written
  const [notFound, setNotFound] = useState<string | null>(null);
  useEffect(() => {
    if (!reveal) return;
    const range = locateText(value, reveal.text, reveal.occurrence);
    setNotFound(range ? null : reveal.text);
    select(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new selection arrives
  }, [reveal?.id]);

  /** Selects a range of the JSON and scrolls it into view. */
  function select(range: { start: number; end: number } | null) {
    if (range) editor.current?.select(range.start, range.end);
  }

  const errors = result ? result.errors : previewIssues;
  const warnings = result?.warnings ?? [];

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Document</h2>
          <p className="text-xs text-subtlest">
            Full control: any section, tag, class and style. The preview updates as you type.
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Tooltip content="Replace the editor content with an example resume">
            <Button size="compact" variant="subtle" onClick={loadSample} aria-label="Load sample">
              <FileText /> <span className="@max-md:sr-only">Load sample</span>
            </Button>
          </Tooltip>
          <Tooltip content="Every tag, style and limit a document may use">
            <Button size="compact" variant="subtle" onClick={() => setRulesOpen(true)} aria-label="Rules">
              <BookOpen /> <span className="@max-md:sr-only">Rules</span>
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Document tools">
        <Button size="compact" variant="primary" isLoading={checking === "strict"} disabled={!!checking || !value.trim()}
          onClick={() => check("strict")}>
          <ShieldCheck /> Check
        </Button>
        <Button size="compact" isLoading={checking === "lenient"} disabled={!!checking || !value.trim()}
          onClick={() => check("lenient")}>
          <Wand2 /> Auto-fix
        </Button>
        <Button size="compact" disabled={!value.trim()} onClick={format}>
          <AlignLeft /> Format
        </Button>
        <FieldsMenu hint="Insert at the cursor (quoted when needed)" onPick={(placeholder) => editor.current?.insertJsonText(placeholder)} />
        <Tooltip content="Empty the editor to paste your own document">
          <Button size="compact" variant="subtle" className="ml-auto" disabled={!value.trim()} aria-label="Clear"
            onClick={() => setPending("clear")}>
            <Eraser /> <span className="@max-md:sr-only">Clear</span>
          </Button>
        </Tooltip>
      </div>

      {notice && <p className="rounded-sm bg-information px-3 py-2 text-sm text-information-text">{notice}</p>}

      <CodeEditor
        ref={editor}
        aria-label="Document JSON"
        aria-describedby="resume-document-status"
        placeholder="Paste a document here, or press Load sample"
        value={value}
        invalid={!!parseError}
        onChange={(text) => {
          onChange(text);
          setResult(null);
        }}
      />
      <p className="-mt-1 text-xs text-subtlest">
        Click the arrows next to the line numbers to collapse or expand. Ctrl/⌘+F finds and replaces, Ctrl/⌘+Z undoes,
        Ctrl/⌘+[ and ] indent.
      </p>

      <div id="resume-document-status" aria-live="polite" className="flex flex-col gap-2">
        {parseError && (
          <SectionMessage appearance="error" title="Invalid JSON">
            {parseError} If you pasted it from a chat, press Auto-fix to repair common copy-paste problems.
          </SectionMessage>
        )}
        {error && <SectionMessage appearance="error" title="Couldn't check the document">{error}</SectionMessage>}
        {notFound && (
          <p className="text-xs text-subtlest">
            &ldquo;{notFound.length > 60 ? `${notFound.slice(0, 57)}…` : notFound}&rdquo; isn&apos;t written as is in the
            document (it may come from a template or be split by formatting). Try selecting fewer words.
          </p>
        )}
        {result?.valid && (
          <SectionMessage appearance="success" title={result.document ? "Fixed and valid" : "Valid"}>
            {result.pages !== null && `${result.pages} ${result.pages === 1 ? "page" : "pages"}. `}
            {warnings.length > 0 ? `${warnings.length} ${warnings.length === 1 ? "note" : "notes"} below.` : "No problems found."}
          </SectionMessage>
        )}
        {!parseError && errors.length > 0 && (
          <IssueList title={`${errors.length} ${errors.length === 1 ? "problem" : "problems"}`} issues={errors}
            appearance="removed" onSelect={goTo} />
        )}
        {warnings.length > 0 && (
          <IssueList title={result?.document ? "What was fixed" : "Notes"} issues={warnings} appearance="moved"
            onSelect={result?.document ? undefined : goTo} />
        )}
      </div>

      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} document={value} />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending === "clear" ? "Clear the document?" : "Replace with the sample?"}
        description={pending === "clear"
          ? "The editor will be empty so you can paste your own document. Unsaved changes are lost."
          : "The sample document replaces what's in the editor. Unsaved changes are lost."}
        confirmLabel={pending === "clear" ? "Clear" : "Load sample"}
        appearance={pending === "clear" ? "danger" : "primary"}
        onConfirm={() => replaceWith(pending === "clear" ? "" : SAMPLE_DOCUMENT_TEXT)}
      />
    </Card>
  );
}

function IssueList({ title, issues, appearance, onSelect }: {
  title: string;
  issues: DocIssue[];
  appearance: "removed" | "moved";
  onSelect?: (issue: DocIssue) => void;
}) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <h3 className="text-xs font-semibold text-subtle">{title}</h3>
      <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto overscroll-contain rounded-sm border border-border">
        {issues.slice(0, 100).map((issue, i) => (
          <li key={`${issue.path}-${issue.code}-${i}`}>
            {onSelect ? (
              <Button variant="subtle" className="h-auto w-full flex-col items-start gap-1 rounded-none px-3 py-2 text-left whitespace-normal pointer-coarse:h-auto"
                onClick={() => onSelect(issue)}>
                <IssueContent issue={issue} appearance={appearance} />
              </Button>
            ) : (
              <div className="flex flex-col items-start gap-1 px-3 py-2">
                <IssueContent issue={issue} appearance={appearance} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function IssueContent({ issue, appearance }: { issue: DocIssue; appearance: "removed" | "moved" }) {
  return (
    <>
      <span className="flex max-w-full flex-wrap items-center gap-2">
        <Lozenge appearance={appearance}>{issue.code.replaceAll("_", " ").toLowerCase()}</Lozenge>
        <code className="min-w-0 text-xs break-all text-subtlest">{issue.path || "/"}</code>
      </span>
      <span className="text-sm font-normal text-foreground">{issue.message}</span>
    </>
  );
}

/** The full document rules (the same text AI assistants get). */
function RulesDialog({ open, onOpenChange, document }: { open: boolean; onOpenChange: (open: boolean) => void; document: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Document rules</DialogTitle>
          <DialogDescription>Everything a document may contain: tags, attributes, styles, fonts and limits.</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-6">{open && <RulesText document={document} />}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** What gets copied with "Copy rules + my document": ready to paste into an AI chat, followed by a request. */
function withDocument(rules: string, document: string) {
  return [
    rules.trim(),
    "",
    "---",
    "",
    "## My current document",
    "",
    "Edit this document as I ask below. Reply with ONLY the complete JSON document (no explanations, no code fences).",
    "",
    document.trim(),
    "",
    "## My request",
    "",
  ].join("\n");
}

function RulesText({ document }: { document: string }) {
  const { getToken } = useAuth();
  const [rules, setRules] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then((token) => getDocumentRules(token))
      .then((text) => !cancelled && setRules(text))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const [copied, setCopied] = useState<"rules" | "both" | "failed" | null>(null);

  async function copy(kind: "rules" | "both") {
    if (rules === null) return;
    try {
      await navigator.clipboard.writeText(kind === "rules" ? rules : withDocument(rules, document));
      setCopied(kind);
    } catch {
      setCopied("failed");
    }
  }

  function download() {
    if (rules === null) return;
    const url = URL.createObjectURL(new Blob([rules], { type: "text/markdown" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "careerpilot-document-rules.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  if (failed) return <SectionMessage appearance="error" title="Couldn't load the rules" />;
  if (rules === null) {
    return <div className="flex items-center gap-2 py-6 text-subtle"><Spinner /> Loading…</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Rules">
        <Button size="compact" variant="primary" onClick={() => copy("rules")}>
          {copied === "rules" ? <Check /> : <Copy />} {copied === "rules" ? "Copied" : "Copy rules"}
        </Button>
        <Button size="compact" disabled={!document.trim()} onClick={() => copy("both")}>
          {copied === "both" ? <Check /> : <Copy />} {copied === "both" ? "Copied" : "Copy rules + my document"}
        </Button>
        <Button size="compact" variant="subtle" onClick={download}>
          <Download /> Download .md
        </Button>
      </div>
      <p className="text-xs text-subtlest" aria-live="polite">
        {copied === "failed"
          ? "Your browser blocked copying. Use Download instead."
          : "Paste into ChatGPT, Claude or Gemini, then paste their JSON reply into the editor and press Check."}
      </p>
      <pre className="overflow-x-auto rounded-sm bg-surface-sunken p-3 font-mono text-xs leading-5 whitespace-pre-wrap">{rules}</pre>
    </div>
  );
}
