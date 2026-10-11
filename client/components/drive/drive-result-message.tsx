"use client";

import { useSearchParams } from "next/navigation";

import { useDriveStatus } from "@/lib/drive/use-drive";
import { SectionMessage } from "@/components/ui/section-message";

/**
 * After returning from Google's consent page (?drive=connected). Clerk sends the browser back here whether or
 * not access was granted, so the message is based on the real status from the server, not the URL alone.
 */
export function DriveResultMessage() {
  const returned = useSearchParams().get("drive") === "connected";
  const status = useDriveStatus();
  if (!returned || !status.data) return null;

  return status.data.connected ? (
    <SectionMessage appearance="success" title="Google Drive connected">
      You can now save PDFs to your Drive.
    </SectionMessage>
  ) : (
    <SectionMessage appearance="warning" title="Google Drive wasn't connected">
      Google didn&apos;t grant file access. Click Connect Google Drive and allow CareerPilot to “see, edit, create and
      delete only the specific Google Drive files you use with this app”.
    </SectionMessage>
  );
}
