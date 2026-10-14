"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listUserFields, saveUserFields, type UserField } from "@/lib/api/fields";

const FIELDS_KEY = ["user-fields"] as const;

/** The signed-in user's saved details ({{github}} …). */
export function useUserFields() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: FIELDS_KEY,
    queryFn: async () => listUserFields(await getToken()),
    enabled: isLoaded && !!isSignedIn,
  });
}

export function useSaveUserFields() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fields: UserField[]) => saveUserFields(fields, await getToken()),
    onSuccess: (saved) => queryClient.setQueryData(FIELDS_KEY, saved),
  });
}
