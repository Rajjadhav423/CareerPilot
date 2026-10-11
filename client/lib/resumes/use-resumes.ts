"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptResumeVersion,
  createResume,
  deleteResume,
  discardResumeVersion,
  getResume,
  getResumeVersionDiff,
  listResumes,
  listResumeTemplates,
  listResumeVersions,
  proposeResumeVersion,
  renderResumePdf,
  updateResume,
  type ProposalInput,
  type RenderInput,
  type ResumeInput,
} from "@/lib/api/resumes";
import { saveResponseAsFile } from "@/lib/api/client";

const RESUMES_KEY = ["resumes"] as const;

/** Waits for Clerk (no token before it loads). */
function useApiAuth() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return { getToken, ready: isLoaded && !!isSignedIn };
}

export function useResumeTemplates() {
  const { getToken, ready } = useApiAuth();
  return useQuery({
    queryKey: ["resume-templates"],
    queryFn: async () => listResumeTemplates(await getToken()),
    enabled: ready,
    staleTime: Infinity,
  });
}

export function useResumes() {
  const { getToken, ready } = useApiAuth();
  return useQuery({ queryKey: RESUMES_KEY, queryFn: async () => listResumes(await getToken()), enabled: ready });
}

export function useResume(id: string | null) {
  const { getToken, ready } = useApiAuth();
  return useQuery({
    queryKey: [...RESUMES_KEY, id],
    queryFn: async () => getResume(id as string, await getToken()),
    enabled: ready && !!id,
  });
}

/** Creates the resume when there's no id yet, otherwise replaces it. */
export function useSaveResume() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: ResumeInput }) =>
      id ? updateResume(id, input, await getToken()) : createResume(input, await getToken()),
    onSuccess: (resume) => {
      queryClient.setQueryData([...RESUMES_KEY, resume.id], resume);
      queryClient.invalidateQueries({ queryKey: RESUMES_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: [...RESUMES_KEY, resume.id, "versions"] });
    },
  });
}

export function useDeleteResume() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteResume(id, await getToken()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RESUMES_KEY }),
  });
}

/** Generates the PDF on the server and saves it with the server's file name. */
export function useDownloadResumePdf() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (input: RenderInput) => {
      const response = await renderResumePdf(input, await getToken());
      await saveResponseAsFile(response, "Resume.pdf");
    },
  });
}

// ---- versions: history and proposals ----

const versionsKey = (resumeId: string) => [...RESUMES_KEY, resumeId, "versions"] as const;

export function useResumeVersions(resumeId: string | null, enabled = true) {
  const { getToken, ready } = useApiAuth();
  return useQuery({
    queryKey: versionsKey(resumeId ?? "none"),
    queryFn: async () => listResumeVersions(resumeId as string, await getToken()),
    enabled: enabled && ready && !!resumeId,
  });
}

export function useResumeVersionDiff(resumeId: string, versionId: string | null) {
  const { getToken, ready } = useApiAuth();
  return useQuery({
    queryKey: [...versionsKey(resumeId), versionId, "diff"],
    queryFn: async () => getResumeVersionDiff(resumeId, versionId as string, await getToken()),
    enabled: ready && !!versionId,
  });
}

export function useProposeResumeVersion(resumeId: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProposalInput) => proposeResumeVersion(resumeId, input, await getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionsKey(resumeId) });
      queryClient.invalidateQueries({ queryKey: RESUMES_KEY, exact: true });
    },
  });
}

/** Accept a proposal or restore an older version; the resume's content changes. */
export function useAcceptResumeVersion(resumeId: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => acceptResumeVersion(resumeId, versionId, await getToken()),
    onSuccess: (resume) => {
      queryClient.setQueryData([...RESUMES_KEY, resume.id], resume);
      queryClient.invalidateQueries({ queryKey: versionsKey(resumeId) });
      queryClient.invalidateQueries({ queryKey: RESUMES_KEY, exact: true });
    },
  });
}

export function useDiscardResumeVersion(resumeId: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => discardResumeVersion(resumeId, versionId, await getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionsKey(resumeId) });
      queryClient.invalidateQueries({ queryKey: RESUMES_KEY, exact: true });
    },
  });
}
