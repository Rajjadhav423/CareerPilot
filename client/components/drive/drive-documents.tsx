"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileText, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";

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
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumnMeta } from "@/components/ui/data-table";
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

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowSelectionFeature,
});
const helper = createColumnHelper<typeof features, DriveDocument>();
const NO_DOCUMENTS: DriveDocument[] = [];

type DocumentActions = {
  download: (document: DriveDocument) => void;
  rename: (document: DriveDocument) => void;
  trash: (document: DriveDocument) => void;
};

function documentColumns(actions: DocumentActions) {
  return helper.columns([
    helper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all documents"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox aria-label={`Select ${row.original.name}`} checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(value === true)} />
      ),
      enableSorting: false,
      meta: { headerClassName: "w-10", cellClassName: "w-10" } satisfies DataTableColumnMeta,
    }),
    helper.accessor("name", {
      header: "Name",
      sortFn: "alphanumeric",
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-danger-bold" aria-hidden />
          <span className="truncate font-medium">{row.original.name}</span>
        </span>
      ),
      meta: { cellClassName: "max-w-0 w-full" } satisfies DataTableColumnMeta,
    }),
    helper.accessor((document) => document.sizeBytes ?? 0, {
      id: "size",
      header: "Size",
      sortFn: "basic",
      cell: ({ row }) => formatSize(row.original.sizeBytes) ?? "—",
      meta: { cellClassName: "whitespace-nowrap text-subtle" } satisfies DataTableColumnMeta,
    }),
    helper.accessor((document) => new Date(document.updatedAt), {
      id: "updated",
      header: "Updated",
      sortFn: "datetime",
      cell: ({ row }) => formatRelativeTime(row.original.updatedAt),
      meta: { cellClassName: "whitespace-nowrap text-subtle" } satisfies DataTableColumnMeta,
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <DocumentRowActions document={row.original} actions={actions} withOpenButton />,
      enableSorting: false,
      meta: { cellClassName: "whitespace-nowrap text-right" } satisfies DataTableColumnMeta,
    }),
  ]);
}

/** Documents CareerPilot saved in the user's Drive: search, sort, open, download, rename, move to trash (one or many). */
export function DriveDocuments() {
  const status = useDriveStatus();
  const connected = !!status.data?.connected;
  const documents = useDriveDocuments(connected);
  const download = useDownloadDriveDocument();
  const rename = useRenameDriveDocument();
  const trash = useTrashDriveDocument();
  const [renaming, setRenaming] = useState<DriveDocument | null>(null);
  const [deleting, setDeleting] = useState<DriveDocument[]>([]);
  const [trashFailures, setTrashFailures] = useState<string[]>([]);
  const [isTrashing, setIsTrashing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [sorting, setSorting] = useState<SortingState>([{ id: "updated", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { mutate: downloadDocument } = download;
  const { reset: resetRename } = rename;
  // The same actions for the table's menu and the narrow layout's cards
  const actions = useMemo<DocumentActions>(() => ({
    download: (document) => downloadDocument({ id: document.id, name: document.name }),
    rename: (document) => { resetRename(); setRenaming(document); },
    trash: (document) => { setTrashFailures([]); setDeleting([document]); },
  }), [downloadDocument, resetRename]);
  const columns = useMemo(() => documentColumns(actions), [actions]);

  const table = useTable({
    features,
    columns,
    data: documents.data ?? NO_DOCUMENTS,
    getRowId: (document) => document.id,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "name",
    enableSortingRemoval: false,
  });
  // Only rows the search shows: a hidden document is never moved to the trash
  const selected = table.getFilteredSelectedRowModel().rows.map((row) => row.original);

  /** Moves the documents to the Drive trash one at a time, so a failure doesn't hide which ones succeeded. */
  async function trashDocuments(targets: DriveDocument[]) {
    setIsTrashing(true);
    const failed: string[] = [];
    for (const document of targets) {
      try {
        await trash.mutateAsync(document.id);
      } catch (error) {
        failed.push(`${document.name}: ${errorText(error)}`);
      }
    }
    setIsTrashing(false);
    setRowSelection({});
    setTrashFailures(failed);
    const moved = targets.length - failed.length;
    if (moved > 0) setNotice(moved === 1 && targets.length === 1 ? `“${targets[0].name}” moved to your Drive trash` : `${moved} documents moved to your Drive trash`);
    if (failed.length === 0) setDeleting([]);
  }

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
    <section aria-label="Documents" className="@container flex flex-col gap-3">
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
        <>
          <div className="flex flex-col gap-2 @xl:flex-row @xl:items-center @xl:justify-between">
            <TextField
              aria-label="Search documents"
              placeholder="Search documents"
              type="search"
              value={globalFilter}
              onChange={(event) => {
                setGlobalFilter(event.target.value);
                // A new search starts a new selection, so nothing out of sight stays selected
                setRowSelection({});
              }}
              elemBefore={<Search className="size-4" aria-hidden />}
              className="@xl:max-w-xs"
            />
            {selected.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-subtle">{selected.length} selected</span>
                <Button variant="subtle" onClick={() => setRowSelection({})}>Clear</Button>
                <Button variant="danger" onClick={() => { setTrashFailures([]); setDeleting(selected); }}>
                  <Trash2 /> Move to trash
                </Button>
              </div>
            )}
          </div>

          <DataTable
            table={table}
            label="Documents"
            empty={
              <p className="rounded-lg border border-border py-10 text-center text-sm text-subtle">
                No documents match your search.
              </p>
            }
            footer={
              <p className="mt-2 text-right text-sm text-subtle">
                {table.getRowModel().rows.length} of {documents.data.length}
              </p>
            }
            renderCard={(row) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  aria-label={`Select ${row.original.name}`}
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(value === true)}
                  className="mt-1"
                />
                <FileText className="mt-0.5 size-5 shrink-0 text-danger-bold" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{row.original.name}</p>
                  <p className="text-xs text-subtlest">
                    {[formatSize(row.original.sizeBytes), `Updated ${formatRelativeTime(row.original.updatedAt)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <DocumentRowActions document={row.original} actions={actions} />
              </div>
            )}
          />
        </>
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
        open={deleting.length > 0}
        onOpenChange={(open) => !open && !isTrashing && setDeleting([])}
        appearance="danger"
        title={deleting.length === 1 ? `Move “${deleting[0].name}” to the trash?` : `Move ${deleting.length} documents to the trash?`}
        description={deleting.length === 1
          ? "It goes to your Google Drive trash, where you can restore it for 30 days."
          : "They go to your Google Drive trash, where you can restore them for 30 days."}
        confirmLabel="Move to trash"
        isLoading={isTrashing}
        onConfirm={() => void trashDocuments(deleting)}
      >
        {trashFailures.length > 0 && (
          <SectionMessage appearance="error" title="Couldn't move some documents">
            <ul className="list-disc pl-4">{trashFailures.map((failure) => <li key={failure}>{failure}</li>)}</ul>
          </SectionMessage>
        )}
      </ConfirmDialog>
    </section>
  );
}

/** Open (wide layout only), plus a menu with open, download, rename and move to trash. */
function DocumentRowActions({ document, actions, withOpenButton = false }: {
  document: DriveDocument; actions: DocumentActions; withOpenButton?: boolean;
}) {
  const link = safeDriveLink(document.webViewLink);
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      {withOpenButton && link && (
        <Button asChild size="compact">
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
        <DropdownMenuContent align="end" className="w-48">
          {link && (
            <DropdownMenuItem asChild>
              <a href={link} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open in Drive
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => actions.download(document)}>
            <Download /> Download
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.rename(document)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => actions.trash(document)}>
            <Trash2 /> Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
