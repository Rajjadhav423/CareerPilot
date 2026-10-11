"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createJob, listJobs, updateJob, type CreateJobInput, type Job, type UpdateJobInput } from "@/lib/api/jobs";

const JOBS_KEY = ["jobs"] as const;

/** The signed-in user's active jobs. Waits for Clerk (no token before it loads). */
export function useJobs() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: JOBS_KEY,
    queryFn: async () => listJobs(await getToken()),
    enabled: isLoaded && !!isSignedIn,
  });
}

export function useCreateJob() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateJobInput) => createJob(input, await getToken()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: JOBS_KEY }),
  });
}

/**
 * Edit, move or archive a job. The board updates immediately (optimistic) and rolls back
 * if the server refuses, so moving cards feels instant.
 */
export function useUpdateJob() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateJobInput }) =>
      updateJob(id, input, await getToken()),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: JOBS_KEY });
      const previous = queryClient.getQueryData<Job[]>(JOBS_KEY);
      queryClient.setQueryData<Job[]>(JOBS_KEY, (jobs = []) =>
        input.archived
          ? jobs.filter((job) => job.id !== id)
          : jobs.map((job) => (job.id === id ? ({ ...job, ...input } as Job) : job)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(JOBS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: JOBS_KEY }),
  });
}
