"use client";

import { Mail } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useConnectGmail, useGmailStatus } from "@/lib/email/use-gmail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { Spinner } from "@/components/ui/spinner";

/** Shows whether application emails can go out from the user's Gmail, with a button to grant permission. */
export function GmailConnectionCard() {
  const status = useGmailStatus();
  const connect = useConnectGmail();

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-information text-information-text">
            <Mail className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Gmail</p>
              <GmailLozenge status={status} />
            </div>
            <p className="text-sm break-words text-subtle">
              <GmailDescription status={status} />
            </p>
          </div>
        </div>
        {status.data?.configured && !status.data.canSend && (
          <Button variant="primary" isLoading={connect.isPending} onClick={() => connect.mutate()} className="self-start sm:self-auto">
            {status.data.connected ? "Allow sending" : "Connect Gmail"}
          </Button>
        )}
      </CardContent>
      {connect.error && (
        <SectionMessage appearance="error" title="Couldn't open Google" className="mx-4 mb-4">
          {connect.error.message}
        </SectionMessage>
      )}
    </Card>
  );
}

type StatusQuery = ReturnType<typeof useGmailStatus>;

function GmailLozenge({ status }: { status: StatusQuery }) {
  if (!status.data) return null;
  if (!status.data.configured) return <Lozenge>Unavailable</Lozenge>;
  if (status.data.canSend) return <Lozenge appearance="success">Ready to send</Lozenge>;
  return <Lozenge appearance="moved">{status.data.connected ? "Permission needed" : "Not connected"}</Lozenge>;
}

function GmailDescription({ status }: { status: StatusQuery }) {
  if (status.isPending) {
    return (
      <span className="inline-flex items-center gap-2">
        <Spinner size="sm" /> Checking your Google connection…
      </span>
    );
  }
  if (status.error) {
    return status.error instanceof ApiError ? status.error.message : "Couldn't check your Google connection.";
  }
  const { configured, connected, canSend, googleEmail } = status.data;
  if (!configured) return "Sending email isn't set up on this server yet. You can still create and preview templates.";
  if (canSend) return `Application emails are sent from ${googleEmail ?? "your Google account"}. You review every email before it goes.`;
  if (connected) {
    return `${googleEmail ?? "Your Google account"} is connected, but CareerPilot doesn't have permission to send email yet. It only asks to send, never to read your inbox.`;
  }
  return "Connect your Google account to send application emails from your own Gmail. CareerPilot only asks to send, never to read your inbox.";
}
