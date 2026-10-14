"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Trophy,
} from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { Job } from "@/lib/api/jobs";
import { formatRelativeTime } from "@/lib/format";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/statuses";
import { useJobs } from "@/lib/jobs/use-jobs";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { AddJobDialog } from "@/components/jobs/add-job-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";

const DAY = 24 * 60 * 60 * 1000;
/** Applied this long ago with no change since: time to follow up */
const FOLLOW_UP_AFTER_DAYS = 7;

/** Segment colours of the pipeline bar, from the status tokens (matching each status lozenge). */
const STATUS_BAR: Record<JobStatus, string> = {
  SAVED: "bg-neutral-bold",
  TO_REVIEW: "bg-discovery-bold",
  PREPARING: "bg-information-bold",
  APPLIED: "bg-information-bold",
  INTERVIEW: "bg-warning-bold",
  OFFER: "bg-success-bold",
  REJECTED: "bg-danger-bold",
  CLOSED: "bg-border-bold",
};

const APPLIED_OR_LATER = new Set<JobStatus>(["APPLIED", "INTERVIEW", "OFFER", "REJECTED"]);

const statusOf = (id: JobStatus) => JOB_STATUSES.find((s) => s.id === id)!;

/** Everything the dashboard shows, worked out from the job list. */
function summarize(jobs: Job[], now: number) {
  const count = (status: JobStatus) => jobs.filter((job) => job.status === status).length;
  const applied = jobs.filter((job) => APPLIED_OR_LATER.has(job.status));
  const heardBack = jobs.filter((job) => job.status === "INTERVIEW" || job.status === "OFFER").length;
  return {
    active: jobs.filter((job) => job.status !== "REJECTED" && job.status !== "CLOSED").length,
    appliedThisWeek: jobs.filter((job) => job.appliedAt && now - Date.parse(job.appliedAt) <= 7 * DAY).length,
    interviews: count("INTERVIEW"),
    offers: count("OFFER"),
    responseRate: applied.length > 0 ? Math.round((heardBack / applied.length) * 100) : null,
    pipeline: JOB_STATUSES.map((status) => ({ ...status, count: count(status.id) })),
    followUps: jobs
      .filter((job) => job.status === "APPLIED" && job.appliedAt && now - Date.parse(job.updatedAt) >= FOLLOW_UP_AFTER_DAYS * DAY)
      .sort((a, b) => Date.parse(a.appliedAt!) - Date.parse(b.appliedAt!))
      .slice(0, 5),
    recent: [...jobs].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6),
    now,
  };
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** The dashboard: greeting and quick actions, key numbers, pipeline, follow-ups and recent activity. */
export function DashboardOverview() {
  const { user } = useUser();
  const jobs = useJobs();
  const [addOpen, setAddOpen] = useState(false);
  // The clock is read only once jobs arrive (in the browser), never while the page is pre-rendered
  const data = useMemo(() => (jobs.data ? summarize(jobs.data, Date.now()) : null), [jobs.data]);
  const now = data?.now ?? null;
  const offline = jobs.error instanceof ApiError && jobs.error.status === 0;

  return (
    <div className="@container flex flex-col gap-6">
      {/* Greeting and quick actions */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl leading-8 font-semibold text-foreground">
            {now === null ? "Welcome back" : greeting(new Date(now).getHours())}{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-subtle">
            {data && data.active > 0
              ? `${data.active} active ${data.active === 1 ? "application" : "applications"}${data.followUps.length > 0
                ? ` · ${data.followUps.length} waiting for a follow-up` : ""}`
              : "Here's where your job search stands."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus /> Add job
          </Button>
          <Button asChild>
            <Link href={ROUTES.discover}><Search /> Find jobs</Link>
          </Button>
          <Button asChild>
            <Link href={ROUTES.resumeNew}><FileText /> New resume</Link>
          </Button>
        </div>
      </header>

      {offline && (
        <SectionMessage appearance="error" title="Can't reach the CareerPilot server">
          Your jobs couldn&apos;t be loaded. Check your connection and refresh; if it keeps happening, the server may be
          restarting.
        </SectionMessage>
      )}
      {jobs.isError && !offline && (
        <SectionMessage appearance="error" title="Couldn't load your jobs">
          {jobs.error instanceof ApiError ? jobs.error.message : "Unexpected error."}
        </SectionMessage>
      )}

      {jobs.isPending && (
        <div className="flex items-center gap-2 py-10 text-subtle"><Spinner /> Loading your dashboard…</div>
      )}

      {data && jobs.data!.length === 0 && <GettingStarted onAddJob={() => setAddOpen(true)} />}

      {data && jobs.data!.length > 0 && (
        <>
          {/* Key numbers */}
          <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-4" aria-label="Key numbers">
            <Stat icon={Briefcase} label="Active applications" value={data.active} hint="Not rejected or closed" />
            <Stat icon={Send} label="Applied this week" value={data.appliedThisWeek} hint="Emails sent in the last 7 days" />
            <Stat icon={MessageSquareText} label="Interviews" value={data.interviews}
              hint={data.responseRate === null ? "No applications yet" : `${data.responseRate}% heard back`} />
            <Stat icon={Trophy} label="Offers" value={data.offers} hint={data.offers > 0 ? "Well done!" : "Keep going"} />
          </ul>

          <div className="grid gap-4 @4xl:grid-cols-3">
            <Pipeline items={data.pipeline} total={jobs.data!.length} className="@4xl:col-span-2" />
            <FollowUps jobs={data.followUps} now={data.now} />
          </div>

          <RecentActivity jobs={data.recent} now={data.now} />
        </>
      )}

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: {
  icon: typeof Briefcase; label: string; value: number; hint: string;
}) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4 shadow-raised">
      <span className="flex items-center gap-2 text-xs font-semibold text-subtle">
        <Icon className="size-4 shrink-0 text-subtlest" aria-hidden />
        {label}
      </span>
      <span className="text-2xl font-semibold text-foreground tabular-nums">{value}</span>
      <span className="truncate text-xs text-subtlest">{hint}</span>
    </li>
  );
}

function Pipeline({ items, total, className }: {
  items: { id: JobStatus; label: string; appearance: Parameters<typeof Lozenge>[0]["appearance"]; count: number }[];
  total: number;
  className?: string;
}) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Pipeline</CardTitle>
          <CardDescription className="mt-1">{total} {total === 1 ? "job" : "jobs"} on your board</CardDescription>
        </div>
        <Button asChild size="compact" variant="subtle">
          <Link href={ROUTES.jobs}>Open board <ArrowRight /></Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* One bar split by status */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral" role="img"
          aria-label={items.filter((i) => i.count > 0).map((i) => `${i.label}: ${i.count}`).join(", ")}>
          {items.filter((item) => item.count > 0).map((item) => (
            <span key={item.id} className={cn("h-full", STATUS_BAR[item.id])} style={{ width: `${(item.count / total) * 100}%` }} />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 @lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-sm px-1 py-0.5">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS_BAR[item.id])} />
                <span className={cn("truncate text-sm", item.count === 0 ? "text-subtlest" : "text-foreground")}>{item.label}</span>
              </span>
              <span className={cn("text-sm font-semibold tabular-nums", item.count === 0 ? "text-subtlest" : "text-foreground")}>
                {item.count}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FollowUps({ jobs, now }: { jobs: Job[]; now: number }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Follow up</CardTitle>
          <CardDescription className="mt-1">Applied {FOLLOW_UP_AFTER_DAYS}+ days ago, no update since</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="flex items-center gap-2 py-2 text-sm text-subtle">
            <CheckCircle2 className="size-4 text-success-text" aria-hidden /> Nothing waiting. You&apos;re up to date.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                  <p className="truncate text-xs text-subtle">
                    {job.company} · applied {Math.floor((now - Date.parse(job.appliedAt!)) / DAY)} days ago
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ jobs, now }: { jobs: Job[]; now: number }) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Recent activity</CardTitle>
          <CardDescription className="mt-1">Jobs you added or moved lately</CardDescription>
        </div>
        <Button asChild size="compact" variant="subtle">
          <Link href={ROUTES.jobsList}>View all <ArrowRight /></Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <ul className="flex flex-col">
          {jobs.map((job) => {
            const status = statusOf(job.status);
            return (
              <li key={job.id}>
                <Link href={ROUTES.jobs}
                  className="flex items-center gap-3 px-4 py-2.5 outline-none hover:bg-surface-hovered focus-visible:bg-surface-hovered">
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-neutral text-xs font-semibold text-subtle">
                    {job.company.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{job.title}</span>
                    <span className="block truncate text-xs text-subtle">
                      {job.company}{job.location ? ` · ${job.location}` : ""}
                    </span>
                  </span>
                  <Lozenge appearance={status.appearance}>{status.label}</Lozenge>
                  <span className="hidden w-24 shrink-0 text-right text-xs text-subtlest @md:block">
                    {formatRelativeTime(job.updatedAt, new Date(now))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/** First visit: the steps that make the app useful. */
function GettingStarted({ onAddJob }: { onAddJob: () => void }) {
  const steps = [
    { icon: Search, title: "Find openings", text: "Search tech roles from company career pages.", action: <Link href={ROUTES.discover}>Find jobs</Link> },
    { icon: Plus, title: "Track a job", text: "Paste a job link: AI fills in the details and the HR email.", action: null },
    { icon: FileText, title: "Build your resume", text: "Write it once with templates; download or save to Drive.", action: <Link href={ROUTES.resumeNew}>New resume</Link> },
    { icon: Mail, title: "Apply by email", text: "Send from your Gmail with a template you can tweak each time.", action: <Link href={ROUTES.templates}>Email templates</Link> },
  ];
  return (
    <Card className="gap-4 p-4 @md:p-5">
      <CardHeader className="p-0">
        <div className="min-w-0">
          <CardTitle>Get started</CardTitle>
          <CardDescription className="mt-1">Four steps to an organised job search.</CardDescription>
        </div>
      </CardHeader>
      <ol className="grid gap-3 @2xl:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-selected text-sm font-semibold text-selected-text">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <step.icon className="size-4 text-subtle" aria-hidden /> {step.title}
              </p>
              <p className="text-sm text-subtle">{step.text}</p>
              <div className="mt-1">
                {step.action ? (
                  <Button asChild size="compact" variant="link" className="px-0">{step.action}</Button>
                ) : (
                  <Button size="compact" variant="link" className="px-0" onClick={onAddJob}>Add a job</Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
