"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Briefcase, ChevronDown, Filter, Plus, Search, X } from "lucide-react";
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
import type { Job } from "@/lib/api/jobs";
import { safeUrl } from "@/lib/safe-url";
import { formatRelativeTime } from "@/lib/format";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/statuses";
import { useJobs, useUpdateJob } from "@/lib/jobs/use-jobs";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumnMeta } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { AddJobDialog } from "./add-job-dialog";
import { JobActionsMenu } from "./job-actions-menu";
import { workModeLabel } from "./job-card";
import { JobStatusSelect } from "./job-status-select";

const statusOrder = Object.fromEntries(JOB_STATUSES.map((status, index) => [status.id, index])) as Record<JobStatus, number>;
const ALL = "ALL";

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
const helper = createColumnHelper<typeof features, Job>();
const NO_JOBS: Job[] = [];

function JobTitle({ job }: { job: Job }) {
  return safeUrl(job.jobUrl) ? (
    <a href={safeUrl(job.jobUrl) ?? undefined} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:text-link hover:underline">
      {job.title}
    </a>
  ) : (
    <span className="font-medium">{job.title}</span>
  );
}

const columns = helper.columns([
  helper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all jobs"
        className="mt-0"
        checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Select ${row.original.title}`}
        className="mt-0"
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(value === true)}
      />
    ),
    enableSorting: false,
    meta: { headerClassName: "w-10", cellClassName: "w-10" } satisfies DataTableColumnMeta,
  }),
  helper.accessor("title", {
    header: "Job",
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <Briefcase className="size-4 shrink-0 text-information-bold" aria-hidden />
        <span className="truncate"><JobTitle job={row.original} /></span>
      </span>
    ),
    meta: { headerClassName: "min-w-48", cellClassName: "max-w-0 w-full min-w-48" } satisfies DataTableColumnMeta,
  }),
  helper.accessor("company", {
    header: "Company",
    sortFn: "alphanumeric",
    cell: ({ row }) => <span className="block max-w-48 truncate">{row.original.company}</span>,
    meta: { cellClassName: "whitespace-nowrap" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((job) => job.location ?? "", {
    id: "location",
    header: "Location",
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <span className="block max-w-48 truncate text-subtle">
        {[row.original.location, row.original.workMode && workModeLabel[row.original.workMode]].filter(Boolean).join(" · ") || "—"}
      </span>
    ),
    meta: { headerClassName: "hidden @5xl:table-cell", cellClassName: "hidden whitespace-nowrap text-subtle @5xl:table-cell" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((job) => new Date(job.createdAt), {
    id: "added",
    header: "Added",
    sortFn: "datetime",
    cell: ({ row }) => formatRelativeTime(row.original.createdAt),
    meta: { cellClassName: "whitespace-nowrap text-subtle" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((job) => statusOrder[job.status] ?? 0, {
    id: "status",
    header: "Status",
    sortFn: "basic",
    cell: ({ row }) => <JobStatusSelect job={row.original} />,
    meta: { cellClassName: "whitespace-nowrap" } satisfies DataTableColumnMeta,
  }),
  helper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <JobActionsMenu job={row.original} />,
    enableSorting: false,
    meta: { headerClassName: "w-12", cellClassName: "w-12 text-right" } satisfies DataTableColumnMeta,
  }),
]);

/** Jira-style List view: search, status filter, checkboxes with bulk actions, inline status, a framed grid table. */
export function JobList() {
  const { data: jobs, isPending, error } = useJobs();
  const updateJob = useUpdateJob();
  const [addOpen, setAddOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "added", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | typeof ALL>(ALL);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const data = useMemo(
    () => (statusFilter === ALL ? (jobs ?? NO_JOBS) : (jobs ?? NO_JOBS).filter((job) => job.status === statusFilter)),
    [jobs, statusFilter],
  );

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (job) => job.id,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => ["title", "company", "location"].includes(column.id),
    enableSortingRemoval: false,
  });
  // Only rows still in view: a job hidden by search or filter is never changed by a bulk action
  const selected = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const shown = table.getRowModel().rows.length;

  function bulkUpdate(input: { status?: JobStatus; archived?: boolean }) {
    for (const job of selected) updateJob.mutate({ id: job.id, input });
    setRowSelection({});
  }

  if (error) {
    return (
      <SectionMessage appearance="error" title="Couldn't load your jobs">
        {error instanceof ApiError ? error.message : "Unexpected error."}
      </SectionMessage>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-subtle">
        <Spinner /> Loading your jobs…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Briefcase />}
          title="No jobs yet"
          description="Save openings from Find jobs, or add one you found elsewhere."
          actions={
            <>
              <Button asChild variant="primary">
                <Link href={ROUTES.discover}>
                  <Search /> Find jobs
                </Link>
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <Plus /> Add job
              </Button>
            </>
          }
        />
        <AddJobDialog open={addOpen} onOpenChange={setAddOpen} />
      </>
    );
  }

  const statusLabel = JOB_STATUSES.find((status) => status.id === statusFilter)?.label;

  return (
    <div className="@container flex flex-col gap-3">
      {/* Jira's list toolbar: search, filter; bulk actions replace it while rows are selected */}
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {selected.length > 0 ? (
          <>
            <span className="text-sm font-medium">{selected.length} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  Move to <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuRadioGroup value="" onValueChange={(status) => bulkUpdate({ status: status as JobStatus })}>
                  {JOB_STATUSES.map((status) => (
                    <DropdownMenuRadioItem key={status.id} value={status.id}>
                      <Lozenge appearance={status.appearance}>{status.label}</Lozenge>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => bulkUpdate({ archived: true })}>
              <Archive /> Archive
            </Button>
            <Button variant="subtle" onClick={() => setRowSelection({})}>
              <X /> Clear
            </Button>
          </>
        ) : (
          <>
            <TextField
              aria-label="Search jobs"
              placeholder="Search jobs"
              type="search"
              value={globalFilter}
              onChange={(event) => {
                setGlobalFilter(event.target.value);
                setRowSelection({});
              }}
              elemBefore={<Search className="size-4" aria-hidden />}
              className="w-full @xl:w-56"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button isSelected={statusFilter !== ALL}>
                  <Filter /> {statusLabel ? `Status: ${statusLabel}` : "Filter"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as JobStatus | typeof ALL);
                    setRowSelection({});
                  }}
                >
                  <DropdownMenuRadioItem value={ALL}>All statuses</DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  {JOB_STATUSES.map((status) => (
                    <DropdownMenuRadioItem key={status.id} value={status.id}>
                      <Lozenge appearance={status.appearance}>{status.label}</Lozenge>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="primary" className="ml-auto" onClick={() => setAddOpen(true)}>
              <Plus /> Add job
            </Button>
          </>
        )}
      </div>

      <DataTable
        table={table}
        label="Jobs"
        empty={
          <p className="rounded-lg border border-border py-10 text-center text-sm text-subtle">
            No jobs match your search or filter.
          </p>
        }
        renderCard={(row) => {
          const job = row.original;
          return (
            <div className="flex items-start gap-3">
              <Checkbox
                aria-label={`Select ${job.title}`}
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(value === true)}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="break-words"><JobTitle job={job} /></span>
                <span className="truncate text-subtle">
                  {job.company}
                  {job.location && ` · ${job.location}`}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <JobStatusSelect job={job} />
                  <span className="text-xs text-subtlest">Added {formatRelativeTime(job.createdAt)}</span>
                </span>
              </div>
              <JobActionsMenu job={job} className="-mr-1" />
            </div>
          );
        }}
        footer={
          <div className="mt-2 flex items-center justify-between gap-2 text-sm text-subtle">
            <Button variant="subtle" onClick={() => setAddOpen(true)}>
              <Plus /> Create
            </Button>
            <span>
              {shown} of {jobs.length}
            </span>
          </div>
        }
      />

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
