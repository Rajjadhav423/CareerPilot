"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Braces, CloudUpload, Download, Eye, FileJson, History, LayoutList, MoreHorizontal, Pencil, Save, Upload } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { isDocDocument, type DocDocument, type DocIssue } from "@/lib/api/docs";
import {
  convertDocumentToForm,
  convertResumeToDocument,
  normalizeResumeJson,
  type PageSize,
  type RenderInput,
  type Resume,
  type ResumeData,
} from "@/lib/api/resumes";
import { describeField, emptyResume, toApi, toEditable, type EditableResume } from "@/lib/resumes/editor";
import { useDownloadResumePdf, useResume, useResumeTemplates, useResumeVersions, useSaveResume } from "@/lib/resumes/use-resumes";
import { locateInFields } from "@/lib/docs/locate-text";
import { starterDocument } from "@/lib/docs/starter";
import { RESUME_VERSIONS_ENABLED } from "@/lib/resumes/features";
import { resumePath } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { SectionMessage } from "@/components/ui/section-message";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { FieldsMenu } from "@/components/settings/fields-menu";
import { DocumentEditorPanel } from "./document-editor-panel";
import { ImportJsonDialog } from "./import-json-dialog";
import { ResumeForm } from "./resume-form";
import { ResumePreview } from "./resume-preview";
import { SaveToDriveDialog } from "./save-to-drive-dialog";
import { VersionHistoryDialog } from "./version-history-dialog";

/**
 * The resume being edited. The form and the document are two views of the same resume and are kept in sync:
 * - `document`: the docEngine document as JSON text (null until the resume has one)
 * - `source`: which side holds the latest edits. "form": the form was edited after the last sync, so the document is
 *   rebuilt from the form (keeping its styles). "document": the document is up to date and is what gets printed.
 */
type Draft = {
  title: string;
  templateId: string;
  pageSize: PageSize;
  resume: EditableResume;
  document: string | null;
  source: "form" | "document";
};

type InputMode = "form" | "document";

/** Loads a saved resume (or starts a new one) and opens the editor. */
export function ResumeEditor({ resumeId }: { resumeId: string | null }) {
  const saved = useResume(resumeId);

  if (resumeId && saved.error) {
    return (
      <SectionMessage appearance="error" title="Couldn't open this resume">
        {saved.error instanceof ApiError ? saved.error.message : "Unexpected error."}
      </SectionMessage>
    );
  }
  if (resumeId && !saved.data) {
    return (
      <div className="flex items-center gap-2 py-10 text-subtle">
        <Spinner /> Loading your resume…
      </div>
    );
  }

  const initial: Draft = saved.data
    ? toDraft(saved.data)
    : { title: "My resume", templateId: "classic", pageSize: "A4", resume: emptyResume(), document: null, source: "form" };

  return <ResumeWorkspace key={resumeId ?? "new"} resumeId={resumeId} initial={initial} />;
}

function toDraft(resume: Resume): Draft {
  return {
    title: resume.title,
    templateId: resume.templateId,
    pageSize: resume.pageSize,
    resume: toEditable(resume.data),
    document: resume.document ? JSON.stringify(resume.document, null, 2) : null,
    source: resume.document ? "document" : "form",
  };
}

/** The document text parsed, or why it can't be used. */
function parseDocument(text: string | null): { doc: DocDocument | null; error: string | null } {
  if (text === null) return { doc: null, error: null };
  try {
    const value: unknown = JSON.parse(text);
    return isDocDocument(value)
      ? { doc: value, error: null }
      : { doc: null, error: "This JSON isn't a document: it needs \"schemaVersion\": 3 (see Rules)." };
  } catch (e) {
    return { doc: null, error: e instanceof SyntaxError ? e.message : "That isn't valid JSON." };
  }
}

function ResumeWorkspace({ resumeId, initial }: { resumeId: string | null; initial: Draft }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const templates = useResumeTemplates();
  const save = useSaveResume();
  const download = useDownloadResumePdf();
  const [draft, setDraft] = useState<Draft>(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial));
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [documentIssues, setDocumentIssues] = useState<DocIssue[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [driveOpen, setDriveOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** A tab switch is converting one side into the other */
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // An example shown in the Document tab while there's nothing to convert yet (new or unfinished form)
  const [starterText, setStarterText] = useState<string | null>(null);
  const [starterNotice, setStarterNotice] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>(initial.source === "document" ? "document" : "form");
  /** Text selected in the preview, for the Document tab to select in the JSON */
  const [reveal, setReveal] = useState<{ text: string; occurrence: number; id: number } | null>(null);
  const formArea = useRef<HTMLDivElement>(null);
  /** A saved detail copied from the Form tab's Details menu, to paste into a field */
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const versions = useResumeVersions(resumeId, RESUME_VERSIONS_ENABLED);
  const pending = versions.data?.filter((v) => v.status === "PROPOSED").length ?? 0;

  const parsed = useMemo(() => parseDocument(draft.document), [draft.document]);
  const fromDocument = draft.source === "document" && draft.document !== null;
  const data: ResumeData = useMemo(() => toApi(draft.resume), [draft.resume]);
  const formInput: RenderInput = useMemo(
    () => ({ templateId: draft.templateId, pageSize: draft.pageSize, data }),
    [draft.templateId, draft.pageSize, data],
  );
  // What gets printed: the document, or the form merged into the document (its styles kept) after form edits
  const renderInput: RenderInput = useMemo(
    () => fromDocument
      ? (parsed.doc ? { ...formInput, document: parsed.doc } : formInput)
      : { ...formInput, baseDocument: parsed.doc },
    [fromDocument, parsed.doc, formInput],
  );
  const canRender = fromDocument ? !!parsed.doc : data.basics.fullName.length > 0;
  // While the Document tab shows the example (not edited yet), preview the example
  const starterDoc = useMemo(
    () => (draft.document === null && inputMode === "document" ? parseDocument(starterText).doc : null),
    [draft.document, inputMode, starterText],
  );
  const previewInput: RenderInput = useMemo(
    () => (starterDoc ? { ...formInput, document: starterDoc } : renderInput),
    [starterDoc, formInput, renderInput],
  );
  const dirty = JSON.stringify(draft) !== savedSnapshot;

  const actionError = save.error ?? download.error;
  // Shown in both tabs: a failed save must always say which field was rejected
  const fieldErrors = actionError instanceof ApiError && Object.keys(actionError.fieldErrors).length > 0
    ? actionError.fieldErrors
    : fromDocument ? {} : previewErrors;
  const issues = actionError instanceof ApiError && actionError.issues.length > 0 ? actionError.issues : documentIssues;

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function saveResume() {
    save.mutate(
      {
        id: resumeId,
        input: {
          title: draft.title.trim() || "My resume",
          ...formInput,
          document: fromDocument ? parsed.doc : null,
          baseDocument: fromDocument ? null : parsed.doc,
        },
      },
      {
        onSuccess: (resume) => {
          // The server returns the document it stored (normalized, or merged from the form)
          const next: Draft = { ...draft, document: resume.document ? JSON.stringify(resume.document, null, 2) : null };
          setDraft(next);
          setSavedSnapshot(JSON.stringify(next));
          if (!resumeId) router.replace(resumePath(resume.id));
        },
      },
    );
  }

  /** A suggestion was accepted or an old version restored: the saved resume is now the editor's content. */
  function applySaved(resume: Resume) {
    const next = toDraft(resume);
    setDraft(next);
    setSavedSnapshot(JSON.stringify(next));
    setInputMode(next.source === "document" ? "document" : "form");
    save.reset();
  }

  /** Form tab: when the document holds the latest edits, read its content into the form first. */
  async function openFormTab() {
    setInputMode("form");
    setSyncError(null);
    if (!fromDocument) return;
    if (!parsed.doc) {
      setSyncError("The document has JSON errors, so the form shows its last synced content. Fix the document to sync.");
      return;
    }
    setSyncing(true);
    try {
      const form = await convertDocumentToForm(parsed.doc, await getToken());
      // Both sides now match; the document stays what gets printed until the form is edited
      setDraft((d) => ({ ...d, resume: toEditable(form.data), templateId: form.templateId, pageSize: form.pageSize }));
    } catch (e) {
      setSyncError(e instanceof ApiError
        ? `${e.message} The form shows its last synced content.`
        : "Couldn't read the document into the form.");
    } finally {
      setSyncing(false);
    }
  }

  /** Document tab: when the form holds the latest edits, rebuild the document from it (keeping its styles). */
  async function openDocumentTab() {
    setInputMode("document");
    setSyncError(null);
    if (fromDocument) return;
    // Nothing to convert yet: start from an example document
    if (draft.document === null && data.basics.fullName.trim() === "") {
      setStarterText(JSON.stringify(starterDocument(), null, 2));
      setStarterNotice("Start from this example: replace the placeholder text or paste a whole document. The form fills in from it.");
      return;
    }
    setSyncing(true);
    try {
      const document = await convertResumeToDocument({ ...formInput, baseDocument: parsed.doc }, await getToken());
      setDraft((d) => ({ ...d, document: JSON.stringify(document, null, 2), source: "document" }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && draft.document === null) {
        // The form has fields the server rejects (e.g. an invalid email): still let them write a document
        setStarterText(JSON.stringify(starterDocument(), null, 2));
        setStarterNotice("Your form has fields that need fixing, so this starts from an example. Edit it or paste a whole document.");
      } else {
        setSyncError(e instanceof ApiError
          ? `${e.message} Fix it in the form; the document shows its last synced content.`
          : "Couldn't update the document from the form.");
      }
    } finally {
      setSyncing(false);
    }
  }

  /** Selecting text in the preview jumps to where it's written: the JSON, or the form field (like SyncTeX). */
  function revealSource(text: string, occurrence: number) {
    setMode("edit"); // phones show one side at a time
    if (inputMode === "document") {
      setReveal({ text, occurrence, id: Date.now() });
      return;
    }
    const fields = Array.from(formArea.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "textarea, input:not([type]), input[type=text], input[type=email], input[type=url], input[type=tel]",
    ) ?? []);
    const found = locateInFields(fields, text, occurrence);
    if (!found) return;
    found.field.scrollIntoView({ block: "center", behavior: "smooth" });
    found.field.focus({ preventScroll: true });
    try {
      found.field.setSelectionRange(found.start, found.end);
    } catch {
      // Email inputs don't support selecting part of the value: focusing the field is enough
    }
  }

  /** Resume form JSON pasted into the Document tab: fill the form with it, then show it as a document. */
  async function importFormJson(json: unknown) {
    const token = await getToken();
    const data = await normalizeResumeJson(json, token);
    const document = await convertResumeToDocument({ templateId: draft.templateId, pageSize: draft.pageSize, data }, token);
    setDraft((d) => ({ ...d, resume: toEditable(data), document: JSON.stringify(document, null, 2), source: "document" }));
    setSyncError(null);
  }

  function replaceWithDocument(document: DocDocument) {
    setDraft((d) => ({ ...d, document: JSON.stringify(document, null, 2), source: "document" }));
    setInputMode("document");
  }

  /** Template and paper size: the form's settings, and the document's when it's what gets printed. */
  function changeSetting(change: { templateId?: string; pageSize?: PageSize }) {
    setDraft((d) => {
      const next = { ...d, ...change };
      if (fromDocument && parsed.doc) {
        const doc: DocDocument = {
          ...parsed.doc,
          ...(change.templateId !== undefined ? { preset: change.templateId } : {}),
          ...(change.pageSize ? { page: { ...parsed.doc.page, size: change.pageSize } } : {}),
        };
        next.document = JSON.stringify(doc, null, 2);
      }
      return next;
    });
  }

  function exportJson() {
    const content = fromDocument ? (parsed.doc ?? draft.document) : data;
    const blob = new Blob([typeof content === "string" ? content : JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(data.basics.fullName || "resume").replace(/[^\w -]+/g, "").trim() || "resume"}${fromDocument ? "-document" : ""}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const fileName = (fromDocument && parsed.doc?.meta?.title) || `${data.basics.fullName || "Resume"} - Resume`;
  const templateValue = fromDocument && parsed.doc ? (parsed.doc.preset ?? draft.templateId) : draft.templateId;
  const pageSizeValue = fromDocument && parsed.doc
    ? (parsed.doc.page?.size?.toUpperCase() === "LETTER" ? "LETTER" : "A4")
    : draft.pageSize;

  return (
    <div className="@container flex flex-col gap-4">
      <Card className="gap-3 p-4">
        <div className="grid gap-3 @2xl:grid-cols-[2fr_1fr_1fr]">
          <Field htmlFor="resume-title" label="Resume name" hint="Only you see this">
            <TextField id="resume-title" value={draft.title} maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field htmlFor="resume-template" label="Template"
            hint={draft.document !== null ? "Starting styles; the document's own styles win"
              : templates.data?.find((t) => t.id === draft.templateId)?.description}>
            <Select id="resume-template" value={templateValue} disabled={fromDocument && !parsed.doc}
              onChange={(e) => changeSetting({ templateId: e.target.value })}>
              {(templates.data ?? [{ id: draft.templateId, name: draft.templateId, description: "" }]).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="resume-page-size" label="Paper size">
            <Select id="resume-page-size" value={pageSizeValue} disabled={fromDocument && !parsed.doc}
              onChange={(e) => changeSetting({ pageSize: e.target.value as PageSize })}>
              <option value="A4">A4</option>
              <option value="LETTER">US Letter</option>
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2 [&>button]:max-sm:flex-1 [&>button]:max-sm:justify-center">
          <Button variant="primary" isLoading={save.isPending} disabled={!canRender} onClick={saveResume}>
            <Save /> {resumeId ? "Save" : "Save resume"}
          </Button>
          <Button isLoading={download.isPending} disabled={!canRender} onClick={() => download.mutate({ ...renderInput, fileName })}>
            <Download /> Download PDF
          </Button>
          <Button disabled={!canRender} onClick={() => setDriveOpen(true)}>
            <CloudUpload /> Save to Drive
          </Button>
          {resumeId && RESUME_VERSIONS_ENABLED && (
            <Button onClick={() => setHistoryOpen(true)}>
              <History /> History
              {pending > 0 && <Badge appearance="primary" aria-label={`${pending} suggestions to review`}>{pending}</Badge>}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="subtle" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                <Upload /> Import (JSON / document)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportJson}>
                <FileJson /> Export {fromDocument ? "document" : "JSON"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs text-subtlest" aria-live="polite">
            {save.isPending ? "Saving…" : dirty ? "Unsaved changes" : resumeId ? "All changes saved" : ""}
          </span>
        </div>

        {actionError && (
          <SectionMessage appearance="error" title={save.error ? "Couldn't save" : "Couldn't create the PDF"}>
            {actionError instanceof ApiError ? actionError.message : "Unexpected error."}
            {actionError instanceof ApiError && actionError.issues.length > 0 && " Open the Document tab to see each problem."}
          </SectionMessage>
        )}
        {Object.keys(fieldErrors).length > 0 && (
          <SectionMessage appearance="warning" title="Fix these fields">
            <ul className="flex list-disc flex-col gap-0.5 pl-4">
              {Object.entries(fieldErrors).slice(0, 8).map(([path, message]) => (
                <li key={path}>{describeField(path, draft.resume)}: {message}</li>
              ))}
            </ul>
          </SectionMessage>
        )}
      </Card>

      {/* Phones and tablets switch between editing and preview; wide screens show both side by side */}
      <div className="flex gap-1 @5xl:hidden" role="group" aria-label="Editor view">
        <Button size="compact" variant="subtle" isSelected={mode === "edit"} onClick={() => setMode("edit")}>
          <Pencil /> Edit
        </Button>
        <Button size="compact" variant="subtle" isSelected={mode === "preview"} onClick={() => setMode("preview")}>
          <Eye /> Preview
        </Button>
      </div>

      <div className="grid gap-4 @5xl:grid-cols-2">
        <div ref={formArea} className={mode === "edit" ? "@container min-w-0" : "@container hidden min-w-0 @5xl:block"}>
          <div className="mb-3 flex flex-wrap items-center gap-1" role="group" aria-label="Edit with">
            <Button size="compact" variant="subtle" isSelected={inputMode === "form"} disabled={syncing} onClick={openFormTab}>
              <LayoutList /> Form
            </Button>
            <Button size="compact" variant="subtle" isSelected={inputMode === "document"} disabled={syncing} onClick={openDocumentTab}>
              <Braces /> Document
            </Button>
            {syncing && <span className="ml-2 flex items-center gap-2 text-xs text-subtle"><Spinner size="sm" /> Syncing…</span>}
            {!syncing && draft.document !== null && (
              <span className="ml-2 hidden text-xs text-subtlest @lg:inline">Form and document stay in sync when you switch tabs</span>
            )}
            {inputMode === "form" && (
              <span className="ml-auto flex items-center gap-2">
                {copiedField && <span className="text-xs text-subtle" aria-live="polite">Copied {copiedField}: paste it in any field</span>}
                <FieldsMenu hint="Copy, then paste into any field" onPick={(placeholder) => {
                  navigator.clipboard.writeText(placeholder).then(() => setCopiedField(placeholder), () => setCopiedField(null));
                }} />
              </span>
            )}
          </div>

          {syncError && (
            <SectionMessage appearance="warning" title="Not synced" className="mb-3">{syncError}</SectionMessage>
          )}

          {inputMode === "form" && !syncing && (
            <ResumeForm value={draft.resume} errors={fieldErrors}
              onChange={(resume) => setDraft((d) => ({ ...d, resume, source: "form" }))} />
          )}
          {inputMode === "document" && !syncing && draft.document !== null && (
            <DocumentEditorPanel value={draft.document} parseError={parsed.error} previewIssues={issues}
              onChange={(text) => setDraft((d) => ({ ...d, document: text, source: "document" }))}
              reveal={reveal} onImportForm={importFormJson} />
          )}
          {inputMode === "document" && !syncing && draft.document === null && starterText !== null && (
            <DocumentEditorPanel value={starterText} parseError={null} previewIssues={[]} notice={starterNotice}
              reveal={reveal} onImportForm={importFormJson}
              onChange={(text) => setDraft((d) => ({ ...d, document: text, source: "document" }))} />
          )}
        </div>
        <div className={mode === "preview" ? "min-w-0" : "hidden min-w-0 @5xl:block"}>
          <div className="@5xl:sticky @5xl:top-16">
            <ResumePreview input={previewInput} ready={canRender || !!starterDoc} onFieldErrors={setPreviewErrors}
              onDocumentIssues={setDocumentIssues} onTextSelect={revealSource} />
          </div>
        </div>
      </div>

      <SaveToDriveDialog open={driveOpen} onOpenChange={setDriveOpen} input={renderInput} resumeId={resumeId}
        defaultFileName={fileName} />
      <ImportJsonDialog open={importOpen} onOpenChange={setImportOpen} resumeId={resumeId}
        onReplace={(imported) => {
          setDraft((d) => ({ ...d, resume: toEditable(imported), source: "form" }));
          setInputMode("form");
        }}
        onReplaceDocument={replaceWithDocument}
        onProposed={() => setHistoryOpen(true)} />
      {resumeId && RESUME_VERSIONS_ENABLED && (
        <VersionHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} resumeId={resumeId} dirty={dirty}
          onApplied={applySaved} />
      )}
    </div>
  );
}
