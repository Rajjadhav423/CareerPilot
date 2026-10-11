"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  listMergeFields,
  listTemplates,
  previewTemplate,
  updateTemplate,
  type TemplateInput,
} from "@/lib/api/templates";

const TEMPLATES_KEY = ["email-templates"] as const;

/** The signed-in user's templates, default first. Waits for Clerk (no token before it loads). */
export function useTemplates() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async () => listTemplates(await getToken()),
    enabled: isLoaded && !!isSignedIn,
  });
}

/** The supported merge fields. Fixed per server release, so cached for the session. */
export function useMergeFields() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["merge-fields"],
    queryFn: async () => listMergeFields(await getToken()),
    enabled: isLoaded && !!isSignedIn,
    staleTime: Infinity,
  });
}

export function useSaveTemplate() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: TemplateInput }) =>
      id ? updateTemplate(id, input, await getToken()) : createTemplate(input, await getToken()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDuplicateTemplate() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => duplicateTemplate(id, await getToken()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDeleteTemplate() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteTemplate(id, await getToken()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

/** Renders subject and body with the server's sample data. */
export function usePreviewTemplate() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (input: { subject: string; body: string }) => previewTemplate(input, await getToken()),
  });
}
