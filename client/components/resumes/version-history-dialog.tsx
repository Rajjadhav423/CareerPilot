"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { Resume, ResumeChange, ResumeVersionSummary, VersionSource } from "@/lib/api/resumes";
import { formatRelativeTime } from "@/lib/format";
import {
  useAcceptResumeVersion,
  useDiscardResumeVersion,
  useResumeVersionDiff,
  useResumeVersions,
} from "@/lib/resumes/use-resumes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";

const SOURCE_LABEL: Record<VersionSource, string> = { EDITOR: "Editor", IMPORT: "Import", AI: "AI", RESTORE: "Restore" };
const KIND_APPEARANCE = {
  ADDED: "success",
  REMOVED: "removed",
  CHANGED: "inprogress",
  MOVED: "default",
  SHOWN: "success",
  HIDDEN: "moved",
} as const;

type VersionHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeId: string;
  /** The editor has unsaved changes, which accepting or restoring would replace. */
  dirty: boolean;
  /** Called with the resume after a suggestion is accepted or a version restored. */
  onApplied: (resume: Resume) => void;
};

/** Saved versions and suggestions (imported or AI JSON): review the changes, accept, discard or restore. */
export function VersionHistoryDialog({ open, onOpenChange, ...props }: VersionHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {open && <History {...props} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function History({ resumeId, dirty, onApplied, onClose }: Omit<VersionHistoryDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const versions = useResumeVersions(resumeId);
  const [reviewing, setReviewing] = useState<ResumeVersionSummary | null>(null);

  const list = versions.data ?? [];
  const currentId = list.find((v) => v.status !== "PROPOSED")?.id;
  const proposals = list.filter((v) => v.status === "PROPOSED");
  const history = list.filter((v) => v.status !== "PROPOSED");

  if (reviewing) {
    return (
      <Review
        resumeId={resumeId}
        version={reviewing}
        isCurrent={reviewing.id === currentId}
        dirty={dirty}
        onBack={() => setReviewing(null)}
        onApplied={(resume) => { onApplied(resume); onClose(); }}
      />
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>History and suggestions</DialogTitle>
        <DialogDescription>Every save is kept (the last 30). Imported and AI JSON waits here until you accept it.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4 py-4">
        {versions.error && (
          <SectionMessage appearance="error" title="Couldn't load the history">
            {versions.error instanceof ApiError ? versions.error.message : "Unexpected error."}
          </SectionMessage>
        )}
        {versions.isPending && (
          <div className="flex items-center gap-2 py-6 text-subtle"><Spinner /> Loading…</div>
        )}
        {proposals.length > 0 && (
          <VersionGroup title="Suggestions to review" versions={proposals} currentId={currentId} onOpen={setReviewing} />
        )}
        {history.length > 0 && (
          <VersionGroup title="Saved versions" versions={history} currentId={currentId} onOpen={setReviewing} />
        )}
      </DialogBody>
    </>
  );
}

function VersionGroup({ title, versions, currentId, onOpen }: {
  title: string; versions: ResumeVersionSummary[]; currentId?: string; onOpen: (v: ResumeVersionSummary) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-subtle">{title}</h3>
      <ul className="flex flex-col divide-y divide-border rounded-sm border border-border">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{v.label || `Version ${v.number}`}</span>
              <span className="text-xs text-subtlest">
                #{v.number} · {SOURCE_LABEL[v.source]} · {formatRelativeTime(v.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {v.id === currentId && <Lozenge appearance="success">Current</Lozenge>}
              {v.status === "ACCEPTED" && <Lozenge appearance="inprogress">Accepted</Lozenge>}
              {v.status === "PROPOSED" && v.changes !== null && (
                <Lozenge appearance="new">{v.changes} {v.changes === 1 ? "change" : "changes"}</Lozenge>
              )}
              <Button size="compact" variant={v.status === "PROPOSED" ? "primary" : "default"} onClick={() => onOpen(v)}>
                {v.status === "PROPOSED" ? "Review" : "View changes"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Review({ resumeId, version, isCurrent, dirty, onBack, onApplied }: {
  resumeId: string; version: ResumeVersionSummary; isCurrent: boolean; dirty: boolean;
  onBack: () => void; onApplied: (resume: Resume) => void;
}) {
  const diff = useResumeVersionDiff(resumeId, version.id);
  const accept = useAcceptResumeVersion(resumeId);
  const discard = useDiscardResumeVersion(resumeId);
  const proposal = version.status === "PROPOSED";
  const busy = accept.isPending || discard.isPending;
  const error = accept.error ?? discard.error;
  const changes = diff.data?.changes ?? [];

  return (
    <>
      <DialogHeader>
        <Button variant="link" size="compact" className="-ml-2 mb-1 self-start" onClick={onBack}>
          <ArrowLeft /> All versions
        </Button>
        <DialogTitle>{version.label || `Version ${version.number}`}</DialogTitle>
        <DialogDescription>
          {proposal ? "What accepting this suggestion changes in your resume." : "How this version differs from your resume now."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3 py-4">
        {dirty && !isCurrent && (
          <SectionMessage appearance="warning" title="You have unsaved changes">
            {proposal ? "Accepting" : "Restoring"} replaces what&apos;s in the editor. Save first if you want to keep your edits in the history.
          </SectionMessage>
        )}
        {error && (
          <SectionMessage appearance="error" title="Something went wrong">
            {error instanceof ApiError ? error.message : "Unexpected error."}
          </SectionMessage>
        )}
        {diff.isPending && <div className="flex items-center gap-2 py-6 text-subtle"><Spinner /> Comparing…</div>}
        {diff.error && (
          <SectionMessage appearance="error" title="Couldn't compare">
            {diff.error instanceof ApiError ? diff.error.message : "Unexpected error."}
          </SectionMessage>
        )}
        {diff.data && changes.length === 0 && <p className="py-4 text-sm text-subtle">No differences from your resume.</p>}
        {changes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {changes.map((change, i) => <ChangeRow key={i} change={change} />)}
          </ul>
        )}
      </DialogBody>
      <DialogFooter>
        {proposal ? (
          <>
            <Button variant="subtle" disabled={busy} isLoading={discard.isPending}
              onClick={() => discard.mutate(version.id, { onSuccess: onBack })}>
              Discard
            </Button>
            <Button variant="primary" disabled={busy} isLoading={accept.isPending}
              onClick={() => accept.mutate(version.id, { onSuccess: onApplied })}>
              Accept suggestion
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={busy || isCurrent || changes.length === 0} isLoading={accept.isPending}
            onClick={() => accept.mutate(version.id, { onSuccess: onApplied })}>
            Restore this version
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function ChangeRow({ change }: { change: ResumeChange }) {
  return (
    <li className="flex flex-col gap-1 rounded-sm border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Lozenge appearance={KIND_APPEARANCE[change.kind]}>{change.kind.toLowerCase()}</Lozenge>
        <span className="min-w-0 text-sm font-medium break-words">
          {change.where}
          {change.field && <span className="font-normal text-subtle"> · {change.field}</span>}
        </span>
      </div>
      {change.before && (
        <p className="rounded-xs bg-danger px-2 py-1 text-xs whitespace-pre-wrap break-words text-danger-text">
          <span className="sr-only">Before: </span><del>{change.before}</del>
        </p>
      )}
      {change.after && (
        <p className="rounded-xs bg-success px-2 py-1 text-xs whitespace-pre-wrap break-words text-success-text">
          <span className="sr-only">After: </span>{change.after}
        </p>
      )}
    </li>
  );
}
