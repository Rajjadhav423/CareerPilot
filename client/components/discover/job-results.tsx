import { ExternalLink } from "lucide-react";

import { TECH_ROLES, type JobPosting, type TechRole, type WorkplaceType } from "@/lib/api/discover";
import { formatRelativeTime } from "@/lib/format";
import { Lozenge } from "@/components/ui/lozenge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

/**
 * Card list when the content area is narrow (phones, tablets, sidebar open),
 * table when it's wide. Uses container queries, so it reacts to the space
 * actually available rather than the screen width.
 */
export function JobResults({ jobs }: { jobs: JobPosting[] }) {
  return (
    <div className="@container">
      <ul className="divide-y divide-border border-y border-border @4xl:hidden">
        {jobs.map((job) => {
          const posted = formatRelativeTime(job.postedAt);
          return (
            <li key={job.id} className="flex flex-col gap-1 py-3">
              <JobLink job={job} />
              <p className="text-sm">
                {job.company}
                {job.location && <span className="text-subtle"> · {job.location}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Lozenge>{roleLabel[job.techRole]}</Lozenge>
                <WorkplaceLozenge type={job.workplaceType} />
                <span className="text-xs text-subtlest">
                  {[posted, job.department, job.source].filter(Boolean).join(" · ")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden @4xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Work mode</TableHead>
              <TableHead>Posted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="max-w-md">
                  <JobLink job={job} />
                  {job.department && <p className="text-xs text-subtlest">{job.department}</p>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {job.company}
                  <p className="text-xs text-subtlest">{job.source}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Lozenge>{roleLabel[job.techRole]}</Lozenge>
                </TableCell>
                <TableCell className="max-w-56 text-subtle">{job.location ?? "—"}</TableCell>
                <TableCell>
                  {workplaceLozenge[job.workplaceType] ? <WorkplaceLozenge type={job.workplaceType} /> : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-subtle">
                  {formatRelativeTime(job.postedAt) ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
