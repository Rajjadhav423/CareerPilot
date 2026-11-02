"use client";

import { useState } from "react";
import { CalendarClock, MoreHorizontal, Send, Trash2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { ScheduledEmail, ScheduledStatus } from "@/lib/api/scheduled-emails";
import { formatSendAt, isFarEnoughAhead, localDate, timeZoneName, toSendAt } from "@/lib/email/schedule-time";
import {
  useCancelScheduledEmail,
  useRescheduleEmail,
  useScheduledEmails,
  useSendScheduledNow,
} from "@/lib/email/use-scheduled-emails";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Lozenge } from "@/components/ui/lozenge";
import { SectionMessage } from "@/components/ui/section-message";
import { TimePicker } from "@/components/ui/time-picker";

const STATUS: Record<ScheduledStatus, { label: string; appearance: "inprogress" | "success" | "removed" | "default" }> = {
  SCHEDULED: { label: "Scheduled", appearance: "inprogress" },
  SENDING: { label: "Sending", appearance: "inprogress" },
  SENT: { label: "Sent", appearance: "success" },
  FAILED: { label: "Failed", appearance: "removed" },
  CANCELLED: { label: "Cancelled", appearance: "default" },
};

/** Sent or cancelled emails shown under the waiting ones */
const RECENT_SHOWN = 5;

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : "Unexpected error.");

/** "HH:MM" of an ISO instant in local time. */
function localTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Change a scheduled email's send time. */
function RescheduleDialog({ email, open, onOpenChange }: { email: ScheduledEmail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const reschedule = useRescheduleEmail();
  const [date, setDate] = useState(() => localDate(new Date(email.sendAt)));
  const [time, setTime] = useState(() => localTime(email.sendAt));
  const [timeError, setTimeError] = useState<string | null>(null);

  function save() {
    const sendAt = toSendAt(date, time);
    if (!isFarEnoughAhead(sendAt)) {
      setTimeError("Pick a time at least a minute from now.");
      return;
    }
    reschedule.mutate({ id: email.id, sendAt }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change send time</DialogTitle>
          <DialogDescription>{email.subject}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3 py-4">
          {reschedule.error && <SectionMessage appearance="error" title="Not changed">{errorText(reschedule.error)}</SectionMessage>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field htmlFor="reschedule-date" label="Date" error={timeError ?? undefined}>
              <DatePicker id="reschedule-date" value={date} onChange={(next) => { setDate(next); setTimeError(null); }} />
            </Field>
            <Field htmlFor="reschedule-time" label="Time" hint={timeZoneName()}>
              <TimePicker id="reschedule-time" value={time} onChange={(next) => { setTime(next); setTimeError(null); }} />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="subtle">Cancel</Button>
          </DialogClose>
          <Button variant="primary" isLoading={reschedule.isPending} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduledRow({ email }: { email: ScheduledEmail }) {
  const sendNow = useSendScheduledNow();
  const cancel = useCancelScheduledEmail();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const waiting = email.status === "SCHEDULED";
  const status = STATUS[email.status];

  return (
    <li className="flex flex-col gap-2 px-3 py-3 @2xl:flex-row @2xl:items-center @2xl:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{email.job.title} <span className="font-normal text-subtle">· {email.job.company}</span></p>
        <p className="truncate text-xs text-subtle">To {email.recipient} · {email.subject}</p>
        {email.status === "FAILED" && email.error && <p className="mt-1 text-xs text-danger-text">{email.error}</p>}
        {sendNow.error && <p className="mt-1 text-xs text-danger-text">{errorText(sendNow.error)}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm whitespace-nowrap text-foreground">
          <CalendarClock className="size-4 text-subtle" aria-hidden /> {formatSendAt(email.sendAt)}
        </span>
        <Lozenge appearance={status.appearance}>{status.label}</Lozenge>
        <div className="ml-auto @2xl:ml-0">
          {(waiting || email.status === "FAILED") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="subtle" size="icon-compact" aria-label={`Actions for the email to ${email.recipient}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {waiting && (
                  <>
                    <DropdownMenuItem onSelect={() => setRescheduleOpen(true)}><CalendarClock /> Change time</DropdownMenuItem>
                    <DropdownMenuItem disabled={sendNow.isPending} onSelect={() => sendNow.mutate(email.id)}><Send /> Send now</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onSelect={() => setCancelOpen(true)}>
                  <Trash2 /> {waiting ? "Cancel email" : "Remove"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {rescheduleOpen && <RescheduleDialog email={email} open={rescheduleOpen} onOpenChange={setRescheduleOpen} />}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={waiting ? "Cancel this scheduled email?" : "Remove this failed email?"}
        description="It won't be sent, and its draft is deleted from your Gmail."
        confirmLabel={waiting ? "Cancel email" : "Remove"}
        cancelLabel="Keep it"
        appearance="danger"
        isLoading={cancel.isPending}
        onConfirm={() => cancel.mutate(email.id, { onSuccess: () => setCancelOpen(false) })}
      >
        {cancel.error && <SectionMessage appearance="error" title="Not cancelled">{errorText(cancel.error)}</SectionMessage>}
      </ConfirmDialog>
    </li>
  );
}

/** Scheduled application emails: waiting or failed ones, then the latest sent or cancelled. Hidden when there are none. */
export function ScheduledEmailList({ className }: { className?: string }) {
  const scheduled = useScheduledEmails();
  const emails = scheduled.data ?? [];
  const open = emails.filter((email) => ["SCHEDULED", "SENDING", "FAILED"].includes(email.status));
  const recent = emails.filter((email) => email.status === "SENT" || email.status === "CANCELLED").slice(0, RECENT_SHOWN);
  if (open.length === 0 && recent.length === 0) return null;

  return (
    <section aria-labelledby="scheduled-title" className={className}>
      <h2 id="scheduled-title" className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
        Scheduled <span className="text-sm font-normal text-subtle">· waiting as drafts in your Gmail</span>
      </h2>
      <ul className="@container divide-y divide-border rounded-lg border border-border bg-surface">
        {open.map((email) => <ScheduledRow key={email.id} email={email} />)}
        {recent.map((email) => <ScheduledRow key={email.id} email={email} />)}
      </ul>
    </section>
  );
}
