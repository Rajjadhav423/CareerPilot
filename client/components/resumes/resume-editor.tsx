"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Braces, CloudUpload, Download, Eye, FileJson, History, LayoutList, MoreHorizontal, Pencil, Save, Upload } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { isDocDocument, type DocDocument, type DocIssue } from "@/lib/api/docs";
import { convertResumeToDocument, type PageSize, type RenderInput, type Resume, type ResumeData } from "@/lib/api/resumes";
import { describeField, emptyResume, toApi, toEditable, type EditableResume } from "@/lib/resumes/editor";
import { useDownloadResumePdf, useResume, useResumeTemplates, useResumeVersions, useSaveResume } from "@/lib/resumes/use-resumes";
import { starterDocument } from "@/lib/docs/starter";
import { RESUME_VERSIONS_ENABLED } from "@/lib/resumes/features";
import { resumePath } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { DocumentEditorPanel } from "./document-editor-panel";
import { ImportJsonDialog } from "./import-json-dialog";
import { ResumeForm } from "./resume-form";
import { ResumePreview } from "./resume-preview";
import { SaveToDriveDialog } from "./save-to-drive-dialog";
import { VersionHistoryDialog } from "./version-history-dialog";

/** `document`: the docEngine document as JSON text (null = the resume uses the form). */
type Draft = { title: string; templateId: string; pageSize: PageSize; resume: EditableResume; document: string | null };

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
    : { title: "My resume", templateId: "classic", pageSize: "A4", resume: emptyResume(), document: null };

  return <ResumeWorkspace key={resumeId ?? "new"} resumeId={resumeId} initial={initial} />;
}

function toDraft(resume: Resume): Draft {
  return {
    title: resume.title,
    templateId: resume.templateId,
    pageSize: resume.pageSize,
    resume: toEditable(resume.data),
    document: resume.document ? JSON.stringify(resume.document, null, 2) : null,
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
  const [leaveDocumentOpen, setLeaveDocumentOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  // The form shown as a document in the Document tab; the resume becomes a document only when it's edited
  const [convertedText, setConvertedText] = useState<string | null>(null);
  /** "form": the form converted; "starter": an example (empty or not-yet-valid form); "invalid-form": example, form needs fixes */
  const [convertedFrom, setConvertedFrom] = useState<"form" | "starter" | "invalid-form">("form");
  const [inputMode, setInputMode] = useState<InputMode>(initial.document !== null ? "document" : "form");
  const versions = useResumeVersions(resumeId, RESUME_VERSIONS_ENABLED);
  const pending = versions.data?.filter((v) => v.status === "PROPOSED").length ?? 0;

  const documentMode = draft.document !== null;
  const parsed = useMemo(() => parseDocument(draft.document), [draft.document]);
  const data: ResumeData = useMemo(() => toApi(draft.resume), [draft.resume]);
  const formInput: RenderInput = useMemo(
    () => ({ templateId: draft.templateId, pageSize: draft.pageSize, data }),
    [draft.templateId, draft.pageSize, data],
  );
  const renderInput: RenderInput = useMemo(
    () => (documentMode && parsed.doc ? { ...formInput, document: parsed.doc } : formInput),
    [documentMode, parsed.doc, formInput],
  );
  const canRender = documentMode ? !!parsed.doc : data.basics.fullName.length > 0;
  // While the Document tab shows the converted form or the starter (not edited yet), preview that document
  const viewedDoc = useMemo(
    () => (!documentMode && inputMode === "document" ? parseDocument(convertedText).doc : null),
    [documentMode, inputMode, convertedText],
  );
  const previewInput: RenderInput = useMemo(
    () => (viewedDoc ? { ...formInput, document: viewedDoc } : renderInput),
    [viewedDoc, formInput, renderInput],
  );
  const dirty = JSON.stringify(draft) !== savedSnapshot;

  const actionError = save.error ?? download.error;
  const fieldErrors = !documentMode && actionError instanceof ApiError && Object.keys(actionError.fieldErrors).length > 0
    ? actionError.fieldErrors
    : documentMode ? {} : previewErrors;
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
        input: { title: draft.title.trim() || "My resume", ...formInput, document: documentMode ? parsed.doc : null },
      },
      {
        onSuccess: (resume) => {
          // The server returns the document normalized; show what was stored
          const next = { ...draft, document: resume.document ? JSON.stringify(resume.document, null, 2) : null };
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
    setInputMode(next.document !== null ? "document" : "form");
    save.reset();
  }

  /** Opens the Document tab; for a form resume, shows the form converted to a document (server, chosen template). */
  async function openDocumentTab() {
    setInputMode("document");
    if (documentMode) return;
    setConvertError(null);
    // A new resume has nothing to convert yet: start from an example document
    if (data.basics.fullName.trim() === "") {
      setConvertedText(JSON.stringify(starterDocument(), null, 2));
      setConvertedFrom("starter");
      return;
    }
    setConverting(true);
    try {
      const document = await convertResumeToDocument(formInput, await getToken());
      setConvertedText(JSON.stringify(document, null, 2));
      setConvertedFrom("form");
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        // The form has fields the server rejects (e.g. an invalid email): still let them write a document
        setConvertedText(JSON.stringify(starterDocument(), null, 2));
        setConvertedFrom("invalid-form");
      } else {
        setConvertError(e instanceof ApiError ? e.message : "Unexpected error.");
      }
    } finally {
      setConverting(false);
    }
  }

  function replaceWithDocument(document: DocDocument) {
    setDraft((d) => ({ ...d, document: JSON.stringify(document, null, 2) }));
    setInputMode("document");
  }

  /** Changes one part of the document (template/paper selects); needs the JSON to parse. */
  function updateDocument(change: (doc: DocDocument) => DocDocument) {
    if (!parsed.doc) return;
    setDraft((d) => ({ ...d, document: JSON.stringify(change(parsed.doc as DocDocument), null, 2) }));
  }

  function exportJson() {
    const content = documentMode ? (parsed.doc ?? draft.document) : data;
    const blob = new Blob([typeof content === "string" ? content : JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(data.basics.fullName || "resume").replace(/[^\w -]+/g, "").trim() || "resume"}${documentMode ? "-document" : ""}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const fileName = (documentMode && parsed.doc?.meta?.title) || `${data.basics.fullName || "Resume"} - Resume`;
  const templateValue = documentMode ? (parsed.doc?.preset ?? "") : draft.templateId;
  const pageSizeValue = documentMode ? (parsed.doc?.page?.size?.toUpperCase() === "LETTER" ? "LETTER" : "A4") : draft.pageSize;
  const selectsDisabled = documentMode && !parsed.doc;

  return (
    <div className="@container flex flex-col gap-4">
      <Card className="gap-3 p-4">
        <div className="grid gap-3 @2xl:grid-cols-[2fr_1fr_1fr]">
          <Field htmlFor="resume-title" label="Resume name" hint="Only you see this">
            <TextField id="resume-title" value={draft.title} maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field htmlFor="resume-template" label={documentMode ? "Preset" : "Template"}
            hint={documentMode ? "Starting styles; the document's own styles win"
              : templates.data?.find((t) => t.id === draft.templateId)?.description}>
            <Select id="resume-template" value={templateValue} disabled={selectsDisabled}
              onChange={(e) => documentMode
                ? updateDocument((doc) => ({ ...doc, preset: e.target.value || undefined }))
                : setDraft({ ...draft, templateId: e.target.value })}>
              {documentMode && <option value="">None (document styles only)</option>}
              {(templates.data ?? [{ id: draft.templateId, name: draft.templateId, description: "" }]).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="resume-page-size" label="Paper size">
            <Select id="resume-page-size" value={pageSizeValue} disabled={selectsDisabled}
              onChange={(e) => documentMode
                ? updateDocument((doc) => ({ ...doc, page: { ...doc.page, size: e.target.value as "A4" | "LETTER" } }))
                : setDraft({ ...draft, pageSize: e.target.value as PageSize })}>
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
                <FileJson /> Export {documentMode ? "document" : "JSON"}
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
        <div className={mode === "edit" ? "@container min-w-0" : "@container hidden min-w-0 @5xl:block"}>
          <div className="mb-3 flex gap-1 overflow-x-auto" role="group" aria-label="Edit with">
            <Button size="compact" variant="subtle" isSelected={inputMode === "form"} onClick={() => setInputMode("form")}>
              <LayoutList /> Form
            </Button>
            <Button size="compact" variant="subtle" isSelected={inputMode === "document"} onClick={openDocumentTab}>
              <Braces /> Document
            </Button>
          </div>

          {inputMode !== "document" && documentMode && (
            <DocumentModeNotice onOpenDocument={() => setInputMode("document")} onUseForm={() => setLeaveDocumentOpen(true)} />
          )}
          {inputMode === "form" && !documentMode && (
            <ResumeForm value={draft.resume} errors={fieldErrors}
              onChange={(resume) => setDraft({ ...draft, resume })} />
          )}
          {inputMode === "document" && documentMode && (
            <DocumentEditorPanel value={draft.document ?? ""} parseError={parsed.error} previewIssues={issues}
              onChange={(text) => setDraft((d) => ({ ...d, document: text }))}
              onBackToForm={() => setLeaveDocumentOpen(true)} />
          )}
          {inputMode === "document" && !documentMode && (
            converting || convertedText === null ? (
              <Card className="gap-3 p-4">
                {convertError ? (
                  <SectionMessage appearance="error" title="Couldn't load the document">
                    {convertError}
                    <div className="mt-3">
                      <Button size="compact" onClick={openDocumentTab}>Try again</Button>
                    </div>
                  </SectionMessage>
                ) : (
                  <div className="flex items-center gap-2 py-6 text-subtle"><Spinner /> Loading the document…</div>
                )}
              </Card>
            ) : (
              <DocumentEditorPanel value={convertedText} parseError={null} previewIssues={[]}
                notice={convertedFrom === "form"
                  ? "This is your form as a document. Editing it makes the resume a document."
                  : convertedFrom === "invalid-form"
                    ? "Your form has fields that need fixing, so this starts from an example. Edit it or paste a whole document; editing makes the resume a document."
                    : "Start from this example: replace the placeholder text or paste a whole document. Editing makes the resume a document."}
                backLabel="Back to the form"
                onChange={(text) => setDraft((d) => ({ ...d, document: text }))}
                onBackToForm={() => setInputMode("form")} />
            )
          )}
        </div>
        <div className={mode === "preview" ? "min-w-0" : "hidden min-w-0 @5xl:block"}>
          <div className="@5xl:sticky @5xl:top-16">
            <ResumePreview input={previewInput} ready={canRender || !!viewedDoc} onFieldErrors={setPreviewErrors}
              onDocumentIssues={setDocumentIssues} />
          </div>
        </div>
      </div>

      <SaveToDriveDialog open={driveOpen} onOpenChange={setDriveOpen} input={renderInput} resumeId={resumeId}
        defaultFileName={fileName} />
      <ImportJsonDialog open={importOpen} onOpenChange={setImportOpen} resumeId={resumeId}
        onReplace={(imported) => {
          setDraft((d) => ({ ...d, resume: toEditable(imported), document: null }));
          setInputMode("form");
        }}
        onReplaceDocument={replaceWithDocument}
        onProposed={() => setHistoryOpen(true)} />
      {resumeId && RESUME_VERSIONS_ENABLED && (
        <VersionHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} resumeId={resumeId} dirty={dirty}
          onApplied={applySaved} />
      )}
      <ConfirmDialog
        open={leaveDocumentOpen}
        onOpenChange={setLeaveDocumentOpen}
        title="Use the form instead?"
        description="The resume goes back to the form content and template. The document is removed when you save; saved versions stay in History."
        confirmLabel="Use the form"
        onConfirm={() => {
          setDraft((d) => ({ ...d, document: null }));
          setDocumentIssues([]);
          setInputMode("form");
          setLeaveDocumentOpen(false);
        }}
      />
    </div>
  );
}

/** Shown in the Form tab while the resume is a document. */
function DocumentModeNotice({ onOpenDocument, onUseForm }: { onOpenDocument: () => void; onUseForm: () => void }) {
  return (
    <SectionMessage appearance="information" title="This resume is a document">
      <p>The form isn&apos;t used while the resume is a document. Edit it in the Document tab, or go back to the form.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="compact" variant="primary" onClick={onOpenDocument}>
          <Braces /> Open the document
        </Button>
        <Button size="compact" onClick={onUseForm}>
          <LayoutList /> Use the form instead
        </Button>
      </div>
    </SectionMessage>
  );
}
