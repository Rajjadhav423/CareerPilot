import { apiFetch, apiFetchResponse } from "./client";
import type { RenderInput } from "./resumes";

/**
 * Mirrors DriveDtos.DriveStatus. Google access comes from Clerk (like Gmail); no tokens reach the browser.
 * `connected` = usable now; `permissionGranted` = Google already allowed drive.file for this account.
 */
export type DriveStatus = {
  configured: boolean;
  connected: boolean;
  permissionGranted: boolean;
  googleEmail: string | null;
  folderId: string | null;
  folderName: string | null;
};

/** Mirrors DriveDtos.DriveFolder: only folders CareerPilot created are visible (drive.file permission). */
export type DriveFolder = { id: string; name: string; selected: boolean };

/** Mirrors DriveDtos.DriveDocumentResponse */
export type DriveDocument = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  webViewLink: string | null;
  folderId: string | null;
  resumeId: string | null;
  createdAt: string;
  updatedAt: string;
};

const BASE = "/api/v1/drive";

export function getDriveStatus(token: string | null) {
  return apiFetch<DriveStatus>(`${BASE}/status`, { token });
}

/** Switches Drive on. `needsGoogleConsent`: ask Google (through Clerk) for `scope` next. */
export function startDriveConnect(token: string | null) {
  return apiFetch<{ needsGoogleConsent: boolean; scope: string }>(`${BASE}/connect`, { method: "POST", token });
}

/** Switches Drive off in CareerPilot. Google's permission stays on the account; files stay in Drive. */
export function disconnectDrive(token: string | null) {
  return apiFetch<void>(`${BASE}/connection`, { method: "DELETE", token });
}

export function listDriveFolders(token: string | null) {
  return apiFetch<DriveFolder[]>(`${BASE}/folders`, { token });
}

export function createDriveFolder(name: string, token: string | null) {
  return apiFetch<DriveFolder>(`${BASE}/folders`, { method: "POST", json: { name }, token });
}

export function selectDriveFolder(folderId: string, token: string | null) {
  return apiFetch<DriveFolder>(`${BASE}/folder`, { method: "PUT", json: { folderId }, token });
}

export function listDriveDocuments(token: string | null) {
  return apiFetch<DriveDocument[]>(`${BASE}/documents`, { token });
}

export function renameDriveDocument(id: string, name: string, token: string | null) {
  return apiFetch<DriveDocument>(`${BASE}/documents/${id}`, { method: "PATCH", json: { name }, token });
}

/** Moves the file to Google Drive's trash. The server refuses without `confirm=true`. */
export function trashDriveDocument(id: string, token: string | null) {
  return apiFetch<void>(`${BASE}/documents/${id}?confirm=true`, { method: "DELETE", token });
}

export function downloadDriveDocument(id: string, token: string | null) {
  return apiFetchResponse(`${BASE}/documents/${id}/download`, "application/pdf", { token });
}

/** Mirrors ResumeController.SaveToDriveRequest. `requestId` makes retries safe (no duplicate files). */
export type SaveToDriveInput = RenderInput & { requestId: string; folderId?: string | null; resumeId?: string | null };

export function saveResumeToDrive(input: SaveToDriveInput, token: string | null) {
  return apiFetch<DriveDocument>("/api/v1/resumes/render/drive", { method: "POST", json: input, token });
}
