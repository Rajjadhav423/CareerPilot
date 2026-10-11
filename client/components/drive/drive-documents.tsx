"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { DriveDocument } from "@/lib/api/drive";
import { safeDriveLink } from "@/lib/drive/links";
import {
  useDownloadDriveDocument,
  useDriveDocuments,
  useDriveStatus,
  useRenameDriveDocument,
  useTrashDriveDocument,
} from "@/lib/drive/use-drive";
import { formatRelativeTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : "Unexpected error.");

function formatSize(bytes: number | null) {
  if (bytes == null) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Documents CareerPilot saved in the user's Drive: open, download, rename, move to trash. */
export function DriveDocuments() {
  const status = useDriveStatus();
  const connected = !!status.data?.connected;
  const documents = useDriveDocuments(connected);
  const download = useDownloadDriveDocument();
  const rename = useRenameDriveDocument();
  const trash = useTrashDriveDocument();
  const [renaming, setRenaming] = useState<DriveDocument | null>(null);
  const [deleting, setDeleting] = useState<DriveDocument | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!connected) return null;

  if (documents.error) {
    return (
      <SectionMessage appearance="error" title="Couldn't load your documents">
        {errorText(documents.error)}
      </SectionMessage>
    );
  }
  if (documents.isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-subtle">
        <Spinner /> Loading your documents from Google Drive…
      </div>
    );
  }

  return (
    <section aria-label="Documents" className="flex flex-col gap-3">
      {notice && <SectionMessage appearance="success" title={notice} />}
      {download.error && (
        <SectionMessage appearance="error" title="Couldn't download the document">{errorText(download.error)}</SectionMessage>
      )}

      {documents.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="No documents yet"
            description="Open a resume and choose Save to Drive. Documents you save appear here."
            actions={
              <Button asChild variant="primary">
                <Link href={ROUTES.resumes}>Go to resumes</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {documents.data.map((document) => {
            const link = safeDriveLink(document.webViewLink);
            return (
              <li key={document.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-5 shrink-0 text-danger-bold" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{document.name}</p>
                  <p className="text-xs text-subtlest">
                    {[formatSize(document.sizeBytes), `Updated ${formatRelativeTime(document.updatedAt)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {link && (
                  <Button asChild size="compact" className="hidden sm:inline-flex">
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink /> Open
                    </a>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="subtle" size="icon-compact" aria-label={`Actions for ${document.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    {link && (
                      <DropdownMenuItem asChild>
                        <a href={link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink /> Open in Drive
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => download.mutate({ id: document.id, name: document.name })}>
                      <Download /> Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => { rename.reset(); setRenaming(document); }}>
                      <Pencil /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => { trash.reset(); setDeleting(document); }}>
                      <Trash2 /> Move to trash
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
      {download.isPending && (
        <p className="flex items-center gap-2 text-sm text-subtle"><Spinner size="sm" /> Downloading…</p>
      )}

      <RenameDialog
        document={renaming}
        onClose={() => setRenaming(null)}
        isSaving={rename.isPending}
        error={rename.error ? errorText(rename.error) : null}
        onSave={(name) =>
          renaming &&
          rename.mutate({ id: renaming.id, name }, {
            onSuccess: (updated) => {
              setRenaming(null);
              setNotice(`Renamed to “${updated.name}”`);
            },
          })
        }
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        appearance="danger"
        title={`Move “${deleting?.name ?? ""}” to the trash?`}
        description="It goes to your Google Drive trash, where you can restore it for 30 days."
        confirmLabel="Move to trash"
        isLoading={trash.isPending}
        onConfirm={() =>
          deleting &&
          trash.mutate(deleting.id, {
            onSuccess: () => {
              setNotice(`“${deleting.name}” moved to your Drive trash`);
              setDeleting(null);
            },
          })
        }
      >
        {trash.error && <SectionMessage appearance="error" title="Couldn't move it">{errorText(trash.error)}</SectionMessage>}
      </ConfirmDialog>
    </section>
  );
}

function RenameDialog({ document, onClose, onSave, isSaving, error }: {
  document: DriveDocument | null;
  onClose: () => void;
  onSave: (name: string) => void;
  isSaving: boolean;
  error: string | null;
}) {
  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-w-md">
        {document && <RenameForm key={document.id} initial={document.name} onSave={onSave} isSaving={isSaving} error={error} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ initial, onSave, isSaving, error }: {
  initial: string; onSave: (name: string) => void; isSaving: boolean; error: string | null;
}) {
  const [name, setName] = useState(initial.replace(/\.pdf$/i, ""));
  return (
    <form
      noValidate
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename document</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3 py-4">
        {error && <SectionMessage appearance="error" title="Couldn't rename">{error}</SectionMessage>}
        <Field htmlFor="rename-document" label="Name" hint=".pdf is kept automatically">
          <TextField id="rename-document" autoFocus value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="subtle" disabled={isSaving}>Cancel</Button>
        </DialogClose>
        <Button type="submit" variant="primary" isLoading={isSaving} disabled={!name.trim()}>Rename</Button>
      </DialogFooter>
    </form>
  );
}
