"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";

import { TECH_ROLES, type JobPosting, type TechRole, type WorkplaceType } from "@/lib/api/discover";
import { formatRelativeTime } from "@/lib/format";
import { Lozenge } from "@/components/ui/lozenge";
import { DataTable, type DataTableColumnMeta } from "@/components/ui/data-table";
import { EmailHrButton, SaveJobButton } from "./save-job-button";

const workplaceLozenge: Record<WorkplaceType, { label: string; appearance: "new" | "inprogress" | "default" } | null> = {
  REMOTE: { label: "Remote", appearance: "new" },
  HYBRID: { label: "Hybrid", appearance: "inprogress" },
  ONSITE: { label: "On-site", appearance: "default" },
  UNSPECIFIED: null,
};

export const roleLabel = Object.fromEntries(TECH_ROLES.map((r) => [r.id, r.label])) as Record<TechRole, string>;

function JobLink({ job }: { job: JobPosting }) {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-start gap-1 font-medium text-link hover:underline"
    >
      {job.title}
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 opacity-0 group-hover:opacity-100" aria-hidden />
    </a>
  );
}

function WorkplaceLozenge({ type }: { type: WorkplaceType }) {
  const workplace = workplaceLozenge[type];
  return workplace ? <Lozenge appearance={workplace.appearance}>{workplace.label}</Lozenge> : null;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime },
});
const helper = createColumnHelper<typeof features, JobPosting>();

/** "85%" lozenge coloured by how well the resume covers the job's skills. */
function MatchLozenge({ job }: { job: JobPosting }) {
  if (!job.match) return <span className="text-xs text-subtlest" title="The post names no skills we know">—</span>;
  const { score } = job.match;
  return (
    <Lozenge appearance={score >= 70 ? "success" : score >= 40 ? "moved" : "default"} isBold={score >= 70}>
      {score}% match
    </Lozenge>
  );
}

/** "Has: Java, AWS · Missing: Kafka" — which of the job's skills the resume covers. */
function MatchSkills({ job }: { job: JobPosting }) {
  if (!job.match) return null;
  const { matched, missing } = job.match;
  return (
    <p className="line-clamp-2 text-xs text-subtle">
      {matched.length > 0 && <><span className="text-success-text">Has:</span> {matched.join(", ")}</>}
      {matched.length > 0 && missing.length > 0 && " · "}
      {missing.length > 0 && <><span className="text-subtlest">Missing:</span> {missing.join(", ")}</>}
    </p>
  );
}

const matchColumn = helper.accessor((job) => job.match?.score ?? -1, {
  id: "match",
  header: "Match",
  sortFn: "alphanumeric",
  cell: ({ row }) => <MatchLozenge job={row.original} />,
  meta: { cellClassName: "whitespace-nowrap" } satisfies DataTableColumnMeta,
});

const baseColumns = helper.columns([
  helper.accessor("title", {
    header: "Job",
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <>
        <JobLink job={row.original} />
        {row.original.match
          ? <MatchSkills job={row.original} />
          : row.original.department && <p className="line-clamp-2 text-xs text-subtlest">{row.original.department}</p>}
      </>
    ),
    meta: { cellClassName: "max-w-md" } satisfies DataTableColumnMeta,
  }),
  helper.accessor("company", {
    header: "Company",
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <>
        {row.original.company}
        <p className="text-xs text-subtlest">{sourceLabel(row.original)}</p>
        <ContactEmail job={row.original} />
      </>
    ),
    meta: { cellClassName: "whitespace-nowrap" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((job) => roleLabel[job.techRole], {
    id: "role",
    header: "Role",
    sortFn: "alphanumeric",
    cell: ({ row }) => <Lozenge>{roleLabel[row.original.techRole]}</Lozenge>,
    meta: { cellClassName: "whitespace-nowrap" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((job) => job.location ?? "", {
    id: "location",
    header: "Location",
    sortFn: "alphanumeric",
    cell: ({ row }) => row.original.location ?? "—",
    meta: { cellClassName: "max-w-56 text-subtle" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((job) => workplaceLozenge[job.workplaceType]?.label ?? "", {
    id: "workMode",
    header: "Work mode",
    sortFn: "alphanumeric",
    cell: ({ row }) => (workplaceLozenge[row.original.workplaceType] ? <WorkplaceLozenge type={row.original.workplaceType} /> : "—"),
  }),
  helper.accessor((job) => (job.postedAt ? new Date(job.postedAt) : new Date(0)), {
    id: "posted",
    header: "Posted",
    sortFn: "datetime",
    cell: ({ row }) => formatRelativeTime(row.original.postedAt) ?? "—",
    meta: { cellClassName: "whitespace-nowrap text-subtle" } satisfies DataTableColumnMeta,
  }),
  helper.display({
    id: "save",
    header: () => <span className="sr-only">Save</span>,
    cell: ({ row }) => (
      <div className="flex justify-end gap-1.5">
        <EmailHrButton posting={row.original} />
        <SaveJobButton posting={row.original} />
      </div>
    ),
    enableSorting: false,
    meta: { cellClassName: "text-right" } satisfies DataTableColumnMeta,
  }),
]);

const columns = baseColumns;
/** With a "Match" column first, when results are matched against a resume */
const matchColumns = helper.columns([matchColumn, ...baseColumns]);

/**
 * Search results in the shared list table (cards when the content area is narrow), sortable by any column.
 * `matching`: results carry a resume match; shows the Match column and each job's matched and missing skills.
 */
export function JobResults({ jobs, matching = false }: { jobs: JobPosting[]; matching?: boolean }) {
  // Empty = the order the search returned (best match first)
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features,
    columns: matching ? matchColumns : columns,
    data: jobs,
    getRowId: (job) => job.id,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <DataTable
      table={table}
      label="Job results"
      renderCard={(row) => {
        const job = row.original;
        const posted = formatRelativeTime(job.postedAt);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <JobLink job={job} />
              <div className="flex shrink-0 gap-1.5">
                <EmailHrButton posting={job} />
                <SaveJobButton posting={job} />
              </div>
            </div>
            <p className="text-sm">
              {job.company}
              {job.location && <span className="text-subtle"> · {job.location}</span>}
            </p>
            <ContactEmail job={job} />
            {matching && <MatchSkills job={job} />}
            <div className="flex flex-wrap items-center gap-1.5">
              {matching && <MatchLozenge job={job} />}
              <Lozenge>{roleLabel[job.techRole]}</Lozenge>
              <WorkplaceLozenge type={job.workplaceType} />
              <span className="text-xs text-subtlest">
                {[posted, job.department, sourceLabel(job)].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
        );
      }}
    />
  );
}

/** "Greenhouse" or "Greenhouse · also on Adzuna, Jooble" (duplicates found on other sources). */
function sourceLabel(job: JobPosting) {
  return job.alsoOn?.length ? `${job.source} · also on ${job.alsoOn.join(", ")}` : job.source;
}

/** The hiring email from the post itself (only shown when the company published one). */
function ContactEmail({ job }: { job: JobPosting }) {
  if (!job.contactEmail) return null;
  return <p className="max-w-full truncate text-xs text-subtle" title="HR email from the post">{job.contactEmail}</p>;
}
