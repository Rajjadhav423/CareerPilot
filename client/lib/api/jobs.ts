import type { JobStatus } from "@/lib/jobs/statuses";

import { apiFetch } from "./client";

export type WorkMode = "ONSITE" | "HYBRID" | "REMOTE";

/** Mirrors com.careerpilot.backend.job.JobDtos.JobResponse */
export type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: WorkMode | null;
  jobUrl: string | null;
  description: string | null;
  notes: string | null;
  status: JobStatus;
  archived: boolean;
  /** MANUAL, or the job board it was saved from (GREENHOUSE / LEVER / ASHBY) */
  source: string;
  /** The Find-jobs posting id when saved from there */
  externalId: string | null;
  /** When an application email was sent (set by the server only after Gmail accepted it) */
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Mirrors JobDtos.CreateJobRequest */
export type CreateJobInput = {
  title: string;
  company: string;
  location?: string | null;
  workMode?: WorkMode | null;
  jobUrl?: string | null;
  description?: string | null;
  notes?: string | null;
  status?: JobStatus;
  source?: string;
  externalId?: string;
};

/** Mirrors JobDtos.UpdateJobRequest: omitted fields stay; "" clears optional text. */
export type UpdateJobInput = Partial<Omit<CreateJobInput, "source" | "externalId">> & { archived?: boolean };

export function listJobs(token: string | null) {
  return apiFetch<Job[]>("/api/v1/jobs", { token });
}

export function createJob(input: CreateJobInput, token: string | null) {
  return apiFetch<Job>("/api/v1/jobs", { method: "POST", json: input, token });
}

export function updateJob(id: string, input: UpdateJobInput, token: string | null) {
  return apiFetch<Job>(`/api/v1/jobs/${id}`, { method: "PATCH", json: input, token });
}
