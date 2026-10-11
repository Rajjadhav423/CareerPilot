"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { RenderInput } from "@/lib/api/resumes";
import { safeDriveLink } from "@/lib/drive/links";
import { useConnectDrive, useDriveFolders, useDriveStatus, useSaveResumeToDrive } from "@/lib/drive/use-drive";
import { newRequestId } from "@/lib/resumes/editor";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SectionMessage } from "@/components/ui/section-message";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";

type SaveToDriveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: RenderInput;
  resumeId: string | null;
  defaultFileName: string;
};

export function SaveToDriveDialog({ open, onOpenChange, ...rest }: SaveToDriveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <SaveToDriveForm {...rest} />}</DialogContent>
    </Dialog>
  );
}

function SaveToDriveForm({ input, resumeId, defaultFileName }: Omit<SaveToDriveDialogProps, "open" | "onOpenChange">) {
  const status = useDriveStatus();
  const connected = !!status.data?.connected;
  const folders = useDriveFolders(connected);
  const connect = useConnectDrive();
  const save = useSaveResumeToDrive();
  // One id per opening of the dialog: retrying after an error can never create a second file
  const [requestId] = useState(newRequestId);
  const [fileName, setFileName] = useState(defaultFileName);
  const [folderChoice, setFolderChoice] = useState<string | null>(null);

  const selectedFolder = folderChoice ?? status.data?.folderId ?? folders.data?.[0]?.id ?? "";
  const saved = save.data;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    save.mutate({ ...input, fileName, requestId, folderId: selectedFolder || null, resumeId });
  }

  if (saved) {
    const link = safeDriveLink(saved.webViewLink);
    return (
      <>
        <DialogHeader>
          <DialogTitle>Saved to Google Drive</DialogTitle>
        </DialogHeader>
        <DialogBody className="py-4">
          <SectionMessage appearance="success" title={saved.name}>
            The PDF is in your CareerPilot folder in Google Drive.
          </SectionMessage>
        </DialogBody>
        <DialogFooter>
          <Button asChild variant="subtle">
            <Link href={ROUTES.documents}>All documents</Link>
          </Button>
          {link && (
            <Button asChild variant="primary">
              <a href={link} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open in Drive
              </a>
            </Button>
          )}
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
      <DialogHeader>
        <DialogTitle>Save PDF to Google Drive</DialogTitle>
        <DialogDescription>CareerPilot can only see and change files it creates in your Drive.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4 py-4">
        {status.isPending && (
          <div className="flex items-center gap-2 text-subtle">
            <Spinner /> Checking your Google Drive connection…
          </div>
        )}
        {status.data && !status.data.configured && (
          <SectionMessage appearance="warning" title="Google Drive isn't available">
            Google Drive isn&apos;t set up on this server yet. You can still download the PDF.
          </SectionMessage>
        )}
        {status.data?.configured && !connected && (
          <SectionMessage
            appearance="information"
            title="Connect Google Drive first"
            actions={
              <Button size="compact" variant="primary" isLoading={connect.isPending} onClick={() => connect.mutate()}>
                Connect Google Drive
              </Button>
            }
          >
            You&apos;ll go to Google and come back to the Documents page. Save your resume first so you don&apos;t lose changes.
            {connect.error && <p className="mt-1 text-danger-text">{connect.error.message}</p>}
          </SectionMessage>
        )}
        {connected && (
          <>
            {save.error && (
              <SectionMessage appearance="error" title="The PDF wasn't saved">
                {save.error instanceof ApiError ? save.error.message : "Unexpected error."} You can try again safely; it
                won&apos;t create a duplicate.
              </SectionMessage>
            )}
            <Field htmlFor="drive-file-name" label="File name" hint=".pdf is added automatically">
              <TextField id="drive-file-name" value={fileName} maxLength={150} onChange={(e) => setFileName(e.target.value)} />
            </Field>
            <Field
              htmlFor="drive-folder"
              label="Folder"
              hint={folders.data?.length ? "Manage folders on the Documents page" : "A “CareerPilot” folder is created for you"}
            >
              <Select
                id="drive-folder"
                value={selectedFolder}
                disabled={folders.isPending || !folders.data?.length}
                onChange={(e) => setFolderChoice(e.target.value)}
              >
                {!folders.data?.length && <option value="">CareerPilot (new)</option>}
                {folders.data?.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-subtlest">Saving to {status.data?.googleEmail ?? "your Google account"}.</p>
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="subtle">Cancel</Button>
        </DialogClose>
        <Button type="submit" variant="primary" disabled={!connected} isLoading={save.isPending}>
          Save to Drive
        </Button>
      </DialogFooter>
    </form>
  );
}
