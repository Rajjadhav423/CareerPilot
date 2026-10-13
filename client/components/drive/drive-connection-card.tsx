"use client";

import { useState } from "react";
import { FolderPlus, HardDrive } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import {
  useConnectDrive,
  useCreateDriveFolder,
  useDisconnectDrive,
  useDriveFolders,
  useDriveStatus,
  useSelectDriveFolder,
} from "@/lib/drive/use-drive";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : "Unexpected error.");

/** Google Drive connection (drive.file only) and the folder new PDFs go into. */
export function DriveConnectionCard() {
  const status = useDriveStatus();
  const connected = !!status.data?.connected;
  const connect = useConnectDrive();
  const disconnect = useDisconnectDrive();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-information text-information-text">
              <HardDrive className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Google Drive</p>
                {status.data && !status.data.configured && <Lozenge>Unavailable</Lozenge>}
                {status.data?.configured && (
                  <Lozenge appearance={connected ? "success" : "moved"}>{connected ? "Connected" : "Not connected"}</Lozenge>
                )}
              </div>
              <p className="text-sm break-words text-subtle">
                {status.isPending ? (
                  <span className="inline-flex items-center gap-2"><Spinner size="sm" /> Checking your connection…</span>
                ) : status.error ? (
                  errorText(status.error)
                ) : !status.data.configured ? (
                  "Google Drive isn't set up on this server yet. You can still download PDFs."
                ) : connected ? (
                  `Saving to ${status.data.googleEmail ?? "your Google account"}. CareerPilot can only see and change files it created.`
                ) : (
                  "Save generated PDFs to your own Google Drive, using the Google account you sign in with. CareerPilot only gets access to files it creates, never the rest of your Drive."
                )}
              </p>
            </div>
          </div>
          {status.data?.configured && (
            connected ? (
              <Button className="self-start sm:self-auto" onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </Button>
            ) : (
              <Button variant="primary" className="self-start sm:self-auto" isLoading={connect.isPending}
                onClick={() => connect.mutate()}>
                {status.data.permissionGranted ? "Turn on Google Drive" : "Connect Google Drive"}
              </Button>
            )
          )}
        </div>

        {connect.error && (
          <SectionMessage appearance="error" title="Couldn't open Google">{errorText(connect.error)}</SectionMessage>
        )}
        {connected && <FolderPicker />}
      </CardContent>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={(open) => {
          setConfirmDisconnect(open);
          if (!open) disconnect.reset();
        }}
        title="Disconnect Google Drive?"
        description="CareerPilot stops using your Drive and forgets its list of documents. Files it already saved stay in your Google Drive. Google's permission stays on your account so you can turn Drive back on with one click; to remove it, use myaccount.google.com/connections (that also removes Gmail sending)."
        confirmLabel="Disconnect"
        isLoading={disconnect.isPending}
        onConfirm={() => disconnect.mutate(undefined, { onSuccess: () => setConfirmDisconnect(false) })}
      >
        {disconnect.error && (
          <SectionMessage appearance="error" title="Couldn't disconnect">{errorText(disconnect.error)}</SectionMessage>
        )}
      </ConfirmDialog>
    </Card>
  );
}

function FolderPicker() {
  const status = useDriveStatus();
  const folders = useDriveFolders(true);
  const select = useSelectDriveFolder();
  const create = useCreateDriveFolder();
  const [newName, setNewName] = useState("");

  const selected = status.data?.folderId ?? "";

  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">
      {(select.error || create.error || folders.error) && (
        <SectionMessage appearance="error" title="Folder action failed">
          {errorText(select.error ?? create.error ?? folders.error)}
        </SectionMessage>
      )}
      {/* grid-cols-1 = minmax(0, 1fr): a long folder name can never make the column wider than the card */}
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
        <Field htmlFor="drive-folder-select" label="Save new PDFs in"
          hint={folders.data?.length ? "Only folders CareerPilot created are listed" : "A “CareerPilot” folder is created on your first save"}>
          <Select
            id="drive-folder-select"
            value={selected}
            disabled={folders.isPending || select.isPending || !folders.data?.length}
            onChange={(e) => e.target.value && select.mutate(e.target.value)}
          >
            {!selected && <option value="">CareerPilot (created automatically)</option>}
            {folders.data?.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </Select>
        </Field>
        <form
          className="flex min-w-0 flex-col gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (newName.trim()) create.mutate(newName.trim(), { onSuccess: () => setNewName("") });
          }}
        >
          <label htmlFor="drive-new-folder" className="text-xs font-semibold text-subtle">New folder</label>
          <div className="flex min-w-0 gap-2">
            <TextField id="drive-new-folder" className="min-w-0 flex-1" placeholder="e.g. Applications 2026" value={newName}
              maxLength={100} onChange={(e) => setNewName(e.target.value)} />
            <Button type="submit" isLoading={create.isPending} disabled={!newName.trim()}>
              <FolderPlus /> Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
