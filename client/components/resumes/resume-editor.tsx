"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Braces, CloudUpload, Download, Eye, FileJson, FileText, History, LayoutList, MoreHorizontal, Pencil, Save, Sparkles, Upload } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { PageSize, RenderInput, Resume, ResumeData } from "@/lib/api/resumes";
import { describeField, emptyResume, toApi, toEditable, type EditableResume } from "@/lib/resumes/editor";
import { useDownloadResumePdf, useResume, useResumeTemplates, useResumeVersions, useSaveResume } from "@/lib/resumes/use-resumes";
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
import { ImportJsonDialog } from "./import-json-dialog";
import { JsonEditorPanel } from "./json-editor-panel";
import { MarkdownEditorPanel } from "./markdown-editor-panel";
import { ResumeForm } from "./resume-form";
import { ResumePreview } from "./resume-preview";
import { SaveToDriveDialog } from "./save-to-drive-dialog";
import { VersionHistoryDialog } from "./version-history-dialog";

type Draft = { title: string; templateId: string; pageSize: PageSize; resume: EditableResume };

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
    : { title: "My resume", templateId: "classic", pageSize: "A4", resume: emptyResume() };

  return <ResumeWorkspace key={resumeId ?? "new"} resumeId={resumeId} initial={initial} />;
}

function toDraft(resume: Resume): Draft {
  return { title: resume.title, templateId: resume.templateId, pageSize: resume.pageSize, resume: toEditable(resume.data) };
}

function ResumeWorkspace({ resumeId, initial }: { resumeId: string | null; initial: Draft }) {
  const router = useRouter();
  const templates = useResumeTemplates();
  const save = useSaveResume();
  const download = useDownloadResumePdf();
  const [draft, setDraft] = useState<Draft>(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial));
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [driveOpen, setDriveOpen] = useState(false);
  const [importMode, setImportMode] = useState<"import" | "ai" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inputMode, setInputMode] = useState<"form" | "json" | "markdown">("form");
  // Kept here so the text survives switching tabs. JSON text is null until edited: it then mirrors the resume.
  const [markdownText, setMarkdownText] = useState("");
  const [jsonText, setJsonText] = useState<string | null>(null);
  const versions = useResumeVersions(resumeId);
  const pending = versions.data?.filter((v) => v.status === "PROPOSED").length ?? 0;

  const data: ResumeData = useMemo(() => toApi(draft.resume), [draft.resume]);
  const renderInput: RenderInput = useMemo(
    () => ({ templateId: draft.templateId, pageSize: draft.pageSize, data }),
    [draft.templateId, draft.pageSize, data],
  );
  const hasName = data.basics.fullName.length > 0;
  const dirty = JSON.stringify(draft) !== savedSnapshot;

  const actionError = save.error ?? download.error;
  const fieldErrors = actionError instanceof ApiError && Object.keys(actionError.fieldErrors).length > 0
    ? actionError.fieldErrors
    : previewErrors;

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function saveResume() {
    save.mutate(
      { id: resumeId, input: { title: draft.title.trim() || "My resume", ...renderInput } },
      {
        onSuccess: (resume) => {
          setSavedSnapshot(JSON.stringify(draft));
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
    setJsonText(null);
    save.reset();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(data.basics.fullName || "resume").replace(/[^\w -]+/g, "").trim() || "resume"}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const fileName = `${data.basics.fullName || "Resume"} - Resume`;

  return (
    <div className="@container flex flex-col gap-4">
      <Card className="gap-3 p-4">
        <div className="grid gap-3 @2xl:grid-cols-[2fr_1fr_1fr]">
          <Field htmlFor="resume-title" label="Resume name" hint="Only you see this">
            <TextField id="resume-title" value={draft.title} maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field htmlFor="resume-template" label="Template"
            hint={templates.data?.find((t) => t.id === draft.templateId)?.description}>
            <Select id="resume-template" value={draft.templateId}
              onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}>
              {(templates.data ?? [{ id: draft.templateId, name: draft.templateId, description: "" }]).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="resume-page-size" label="Paper size">
            <Select id="resume-page-size" value={draft.pageSize}
              onChange={(e) => setDraft({ ...draft, pageSize: e.target.value as PageSize })}>
              <option value="A4">A4</option>
              <option value="LETTER">US Letter</option>
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2 [&>button]:max-sm:flex-1 [&>button]:max-sm:justify-center">
          <Button variant="primary" isLoading={save.isPending} disabled={!hasName} onClick={saveResume}>
            <Save /> {resumeId ? "Save" : "Save resume"}
          </Button>
          <Button isLoading={download.isPending} disabled={!hasName} onClick={() => download.mutate({ ...renderInput, fileName })}>
            <Download /> Download PDF
          </Button>
          <Button disabled={!hasName} onClick={() => setDriveOpen(true)}>
            <CloudUpload /> Save to Drive
          </Button>
          {resumeId && (
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
            <DropdownMenuContent className="w-60">
              <DropdownMenuItem onSelect={() => setImportMode("ai")}>
                <Sparkles /> Improve with ChatGPT or Claude
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setImportMode("import")}>
                <Upload /> Import resume (JSON / Markdown)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportJson}>
                <FileJson /> Export JSON
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
          <div className="mb-3 flex gap-1" role="group" aria-label="Edit with">
            <Button size="compact" variant="subtle" isSelected={inputMode === "form"} onClick={() => setInputMode("form")}>
              <LayoutList /> Form
            </Button>
            <Button size="compact" variant="subtle" isSelected={inputMode === "markdown"} onClick={() => setInputMode("markdown")}>
              <FileText /> Markdown
            </Button>
            <Button size="compact" variant="subtle" isSelected={inputMode === "json"} onClick={() => setInputMode("json")}>
              <Braces /> JSON
            </Button>
          </div>
          {inputMode === "form" && (
            <ResumeForm value={draft.resume} errors={fieldErrors}
              onChange={(resume) => setDraft({ ...draft, resume })} />
          )}
          {inputMode === "markdown" && (
            <MarkdownEditorPanel value={markdownText} onChange={setMarkdownText}
              onApply={(compiled) => {
                setDraft((d) => ({ ...d, resume: toEditable(compiled) }));
                setJsonText(null);
              }} />
          )}
          {inputMode === "json" && (
            <JsonEditorPanel value={jsonText ?? JSON.stringify(data, null, 2)} onChange={setJsonText}
              onCompile={(compiled) => {
                setDraft((d) => ({ ...d, resume: toEditable(compiled) }));
                setJsonText(null);
              }} />
          )}
        </div>
        <div className={mode === "preview" ? "min-w-0" : "hidden min-w-0 @5xl:block"}>
          <div className="@5xl:sticky @5xl:top-16">
            <ResumePreview input={renderInput} ready={hasName} onFieldErrors={setPreviewErrors} />
          </div>
        </div>
      </div>

      <SaveToDriveDialog open={driveOpen} onOpenChange={setDriveOpen} input={renderInput} resumeId={resumeId}
        defaultFileName={fileName} />
      <ImportJsonDialog open={!!importMode} onOpenChange={(open) => !open && setImportMode(null)} mode={importMode ?? "import"}
        resumeId={resumeId} current={data}
        onReplace={(imported) => { setDraft({ ...draft, resume: toEditable(imported) }); setJsonText(null); }}
        onProposed={() => setHistoryOpen(true)} />
      {resumeId && (
        <VersionHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} resumeId={resumeId} dirty={dirty}
          onApplied={applySaved} />
      )}
    </div>
  );
}
