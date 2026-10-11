"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, saveResponseAsFile } from "@/lib/api/client";
import {
  createDriveFolder,
  disconnectDrive,
  downloadDriveDocument,
  getDriveStatus,
  listDriveDocuments,
  listDriveFolders,
  renameDriveDocument,
  saveResumeToDrive,
  selectDriveFolder,
  startDriveConnect,
  trashDriveDocument,
  type SaveToDriveInput,
} from "@/lib/api/drive";
import { GOOGLE_SCOPES, requestGoogleScopes } from "@/lib/google/request-scopes";
import { ROUTES } from "@/lib/routes";

const STATUS_KEY = ["drive", "status"] as const;
const FOLDERS_KEY = ["drive", "folders"] as const;
const DOCUMENTS_KEY = ["drive", "documents"] as const;

/** Errors meaning the stored connection is gone; the status is refetched so the UI shows "Connect". */
const CONNECTION_LOST = new Set(["DRIVE_NOT_CONNECTED", "DRIVE_RECONNECT_REQUIRED", "DRIVE_PERMISSION_MISSING"]);

function useOnDriveError() {
  const queryClient = useQueryClient();
  return (error: Error) => {
    if (error instanceof ApiError && error.code && CONNECTION_LOST.has(error.code)) {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    }
  };
}

export function useDriveStatus() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: async () => getDriveStatus(await getToken()),
    enabled: isLoaded && !!isSignedIn,
  });
}

export function useDriveFolders(enabled: boolean) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: FOLDERS_KEY,
    queryFn: async () => listDriveFolders(await getToken()),
    enabled: enabled && isLoaded && !!isSignedIn,
    retry: false,
  });
}

export function useDriveDocuments(enabled: boolean) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const onError = useOnDriveError();
  return useQuery({
    queryKey: DOCUMENTS_KEY,
    queryFn: async () => {
      try {
        return await listDriveDocuments(await getToken());
      } catch (error) {
        if (error instanceof Error) onError(error);
        throw error;
      }
    },
    enabled: enabled && isLoaded && !!isSignedIn,
    retry: false,
  });
}

/**
 * Turns Drive on. If Google hasn't granted drive.file yet, the browser goes to Google through Clerk (the same
 * Google connection used for sign-in and Gmail) and comes back to the Documents page.
 */
export function useConnectDrive() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You're not signed in.");
      const { needsGoogleConsent } = await startDriveConnect(await getToken());
      if (needsGoogleConsent) {
        const back = new URL(ROUTES.documents, window.location.origin);
        back.searchParams.set("drive", "connected");
        await requestGoogleScopes(user, [GOOGLE_SCOPES.driveFile], back.toString());
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  });
}

export function useDisconnectDrive() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => disconnectDrive(await getToken()),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: DOCUMENTS_KEY });
      queryClient.removeQueries({ queryKey: FOLDERS_KEY });
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });
}

export function useCreateDriveFolder() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const onError = useOnDriveError();
  return useMutation({
    mutationFn: async (name: string) => createDriveFolder(name, await getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError,
  });
}

export function useSelectDriveFolder() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const onError = useOnDriveError();
  return useMutation({
    mutationFn: async (folderId: string) => selectDriveFolder(folderId, await getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError,
  });
}

export function useRenameDriveDocument() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const onError = useOnDriveError();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => renameDriveDocument(id, name, await getToken()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
    onError,
  });
}

export function useTrashDriveDocument() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const onError = useOnDriveError();
  return useMutation({
    mutationFn: async (id: string) => trashDriveDocument(id, await getToken()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
    onError,
  });
}

export function useDownloadDriveDocument() {
  const { getToken } = useAuth();
  const onError = useOnDriveError();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      saveResponseAsFile(await downloadDriveDocument(id, await getToken()), name),
    onError,
  });
}

export function useSaveResumeToDrive() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const onError = useOnDriveError();
  return useMutation({
    mutationFn: async (input: SaveToDriveInput) => saveResumeToDrive(input, await getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError,
  });
}
