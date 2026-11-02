"use client";

import { useMemo, useState } from "react";
import { Copy, Filter, Mail, MailCheck, MoreHorizontal, Search } from "lucide-react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";

import { ApiError } from "@/lib/api/client";
import type { EmailTrackingStatus, SentEmailWithJob } from "@/lib/api/application-emails";
import { useAllSentEmails } from "@/lib/email/use-application-emails";
import { useJobs } from "@/lib/jobs/use-jobs";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumnMeta } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { ComposeEmailDialog } from "@/components/applications/compose-email-dialog";
import { describeEmailStatus, EmailStatusLozenge } from "@/components/applications/email-status";

const STATUSES: { status: EmailTrackingStatus; label: string }[] = [
  { status: "REPLIED", label: "Replied" },
  { status: "OPENED", label: "Opened" },
  { status: "DELIVERED", label: "Delivered" },
  { status: "SENT", label: "Sent" },
  { status: "BOUNCED", label: "Bounced" },
];
const statusOrder = Object.fromEntries(STATUSES.map(({ status }, index) => [status, index])) as Record<EmailTrackingStatus, number>;
const ALL = "ALL";

const jobName = (email: SentEmailWithJob) => (email.job ? email.job.title : email.subject);

/** "2 times, 3 hours ago" or a dash; "Not tracked" for emails sent before open tracking was on. */
function opened(email: SentEmailWithJob) {
  if (email.openCount > 0) {
    return `${email.openCount === 1 ? "Once" : `${email.openCount} times`}, ${formatRelativeTime(email.lastOpenedAt)}`;
  }
  return email.openTracked ? "—" : "Not tracked";
}

const replied = (email: SentEmailWithJob) =>
  email.repliedAt ? formatRelativeTime(email.repliedAt) : email.checkedAt ? "—" : "Not tracked";

/** The ⋯ menu for a sent email, like the job list's row menu. */
function EmailActionsMenu({ email, className }: { email: SentEmailWithJob; className?: string }) {
  const jobs = useJobs();
  const job = jobs.data?.find((candidate) => candidate.id === email.job?.id);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="subtle" size="icon-compact" aria-label={`Actions for email to ${email.recipient}`} className={className}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(email.recipient)}>
          <Copy />
          Copy email address
        </DropdownMenuItem>
        {/* Sent from the user's Gmail into the same thread, tracked like any application email */}
        <DropdownMenuItem disabled={!job} onSelect={() => setFollowUpOpen(true)}>
          <Mail />
          Write a follow-up
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {job && (
      <ComposeEmailDialog
        job={job}
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        followUp={{ id: email.id, recipient: email.recipient, subject: email.subject, sentAt: email.sentAt }}
      />
    )}
    </>
  );
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
});
const helper = createColumnHelper<typeof features, SentEmailWithJob>();
const NO_EMAILS: SentEmailWithJob[] = [];

const columns = helper.columns([
  helper.accessor(jobName, {
    id: "job",
    header: "Job",
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <Mail className="size-4 shrink-0 text-information-bold" aria-hidden />
        <span className="truncate font-medium">{jobName(row.original)}</span>
      </span>
    ),
    meta: { headerClassName: "min-w-48", cellClassName: "max-w-0 w-full min-w-48" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((email) => email.job?.company ?? "", {
    id: "company",
    header: "Company",
    sortFn: "alphanumeric",
    cell: ({ row }) => <span className="block max-w-48 truncate">{row.original.job?.company ?? "—"}</span>,
    meta: { cellClassName: "whitespace-nowrap" } satisfies DataTableColumnMeta,
  }),
  helper.accessor("recipient", {
    header: "To",
    sortFn: "alphanumeric",
    cell: ({ row }) => <span className="block max-w-48 truncate">{row.original.recipient}</span>,
    meta: { cellClassName: "whitespace-nowrap" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((email) => new Date(email.sentAt), {
    id: "sent",
    header: "Sent",
    sortFn: "datetime",
    cell: ({ row }) => formatRelativeTime(row.original.sentAt),
    meta: { cellClassName: "whitespace-nowrap text-subtle" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((email) => email.openCount, {
    id: "opened",
    header: "Opened",
    sortFn: "basic",
    cell: ({ row }) => opened(row.original),
    meta: { headerClassName: "hidden @5xl:table-cell", cellClassName: "hidden whitespace-nowrap text-subtle @5xl:table-cell" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((email) => (email.repliedAt ? new Date(email.repliedAt).getTime() : 0), {
    id: "replied",
    header: "Replied",
    sortFn: "basic",
    cell: ({ row }) => replied(row.original),
    meta: { headerClassName: "hidden @5xl:table-cell", cellClassName: "hidden whitespace-nowrap text-subtle @5xl:table-cell" } satisfies DataTableColumnMeta,
  }),
  helper.accessor((email) => statusOrder[email.status] ?? 0, {
    id: "status",
    header: "Status",
    sortFn: "basic",
    cell: ({ row }) => <EmailStatusLozenge email={row.original} />,
    meta: { cellClassName: "whitespace-nowrap" } satisfies DataTableColumnMeta,
  }),
  helper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <EmailActionsMenu email={row.original} />,
    enableSorting: false,
    meta: { headerClassName: "w-12", cellClassName: "w-12 text-right" } satisfies DataTableColumnMeta,
  }),
]);

/** Every application email with delivery, open and reply tracking, as a Jira List view (Jobs → Emails tab). */
export function SentEmailList() {
  const emails = useAllSentEmails();
  const [sorting, setSorting] = useState<SortingState>([{ id: "sent", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmailTrackingStatus | typeof ALL>(ALL);

  const data = useMemo(() => {
    const all = emails.data ?? NO_EMAILS;
    return statusFilter === ALL ? all : all.filter((email) => email.status === statusFilter);
  }, [emails.data, statusFilter]);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (email) => email.id,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => ["job", "company", "recipient"].includes(column.id),
    enableSortingRemoval: false,
  });

  if (emails.isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-subtle">
        <Spinner /> Checking your sent emails…
      </div>
    );
  }
  if (emails.error) {
    return (
      <SectionMessage appearance="error" title="Couldn't load sent emails">
        {emails.error instanceof ApiError ? emails.error.message : "Unexpected error."}
      </SectionMessage>
    );
  }
  if (emails.data.length === 0) {
    return <EmptyState icon={<MailCheck />} title="No emails sent yet" description="Emails you send from a job show up here." />;
  }

  const count = (status: EmailTrackingStatus) => emails.data.filter((email) => email.status === status).length;
  const statusLabel = STATUSES.find(({ status }) => status === statusFilter)?.label;

  return (
    <div className="@container flex flex-col gap-3">
      {/* Jira's list toolbar */}
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <TextField
          aria-label="Search emails"
          placeholder="Search emails"
          type="search"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
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
              onValueChange={(value) => setStatusFilter(value as EmailTrackingStatus | typeof ALL)}
            >
              <DropdownMenuRadioItem value={ALL}>All statuses ({emails.data.length})</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              {STATUSES.map(({ status, label }) => (
                <DropdownMenuRadioItem key={status} value={status}>
                  {label} ({count(status)})
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataTable
        table={table}
        label="Sent emails"
        empty={
          <p className="rounded-lg border border-border py-10 text-center text-sm text-subtle">
            No emails match your search or filter.
          </p>
        }
        renderCard={(row) => {
          const email = row.original;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium break-words">{jobName(email)}</p>
                  {email.job && <p className="truncate text-subtle">{email.job.company}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <EmailStatusLozenge email={email} />
                  <EmailActionsMenu email={email} className="-mr-1" />
                </span>
              </div>
              <p className="text-sm break-words text-subtle">
                To {email.recipient}, {formatRelativeTime(email.sentAt)}
              </p>
              <p className="text-xs break-words text-subtlest">{describeEmailStatus(email)}</p>
            </div>
          );
        }}
        footer={
          <p className="mt-2 text-right text-sm text-subtle">
            {table.getRowModel().rows.length} of {emails.data.length}
          </p>
        }
      />
    </div>
  );
}
