"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";

import type { ComposedEmail, SendEmailResult } from "@/lib/api/application-emails";
import { ApiError } from "@/lib/api/client";
import type { Job } from "@/lib/api/jobs";
import { findPlaceholders, isValidEmailAddress } from "@/lib/email/placeholders";
import { useComposeEmail, useSendEmail, useSentEmails } from "@/lib/email/use-application-emails";
import { GMAIL_STATUS_KEY, useConnectGmail, useGmailStatus } from "@/lib/email/use-gmail";
import { useTemplates } from "@/lib/email/use-templates";
import { formatRelativeTime } from "@/lib/format";
import { JOB_STATUSES } from "@/lib/jobs/statuses";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";

type ComposeEmailDialogProps = {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Write an application email for one job: pick a template, edit the filled-in draft, review, then send from
 * the user's Gmail. Edits only change this email, never the saved template.
 */
export function ComposeEmailDialog({ job, open, onOpenChange }: ComposeEmailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && <Composer job={job} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

type Draft = { to: string; subject: string; body: string };
type Step = "compose" | "review" | "sent";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Unexpected error.";
}

function Composer({ job, onClose }: { job: Job; onClose: () => void }) {
  const queryClient = useQueryClient();
  const templates = useTemplates();
  const gmail = useGmailStatus();
  const connectGmail = useConnectGmail();
  const sent = useSentEmails(job.id);
  const compose = useComposeEmail(job.id);
  const send = useSendEmail(job.id);

  const [step, setStep] = useState<Step>("compose");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [composed, setComposed] = useState<ComposedEmail | null>(null);
  const [draft, setDraft] = useState<Draft>({ to: "", subject: "", body: "" });
  const [toTouched, setToTouched] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [result, setResult] = useState<SendEmailResult | null>(null);

  const { mutate: runCompose } = compose;

  function loadTemplate(id: string | null) {
    runCompose(id, {
      onSuccess: (email) => {
        setComposed(email);
        setTemplateId(email.templateId);
        // The recipient is kept: it doesn't come from the template
        setDraft((current) => ({ ...current, subject: email.subject, body: email.body }));
      },
    });
  }

  // First draft from the default template (the server picks it when no id is given). Once per opening,
  // also under React Strict Mode's double effects in development.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadTemplate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the dialog opens
  }, []);

  const recipient = draft.to.trim();
  const recipientValid = isValidEmailAddress(recipient);
  const remaining = findPlaceholders(`${draft.subject}\n${draft.body}`);
  const missingStill = (composed?.missingFields ?? []).filter((field) => remaining.includes(field.placeholder));
  const otherStill = remaining.filter((p) => !missingStill.some((field) => field.placeholder === p));
  const canSend = !!gmail.data?.canSend;
  const ready = recipientValid && remaining.length === 0 && !!draft.subject.trim() && !!draft.body.trim();

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function confirmAndSend() {
    send.mutate(
      { to: recipient, subject: draft.subject.trim(), body: draft.body, templateId, confirmed: true },
      {
        onSuccess: (sentResult) => {
          setResult(sentResult);
          setStep("sent");
        },
        onError: (error) => {
          // Connection problems: refresh the status so the dialog shows the right fix
          if (error instanceof ApiError && error.code?.startsWith("GMAIL_")) {
            queryClient.invalidateQueries({ queryKey: GMAIL_STATUS_KEY });
          }
        },
      },
    );
  }

  if (step === "sent" && result) {
    const statusLabel = JOB_STATUSES.find((s) => s.id === result.jobStatus)?.label ?? result.jobStatus;
    return (
      <>
        <DialogHeader>
          <DialogTitle>Email sent</DialogTitle>
          <DialogDescription>
            {job.title} at {job.company}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          <SectionMessage appearance="success" title={`Gmail accepted your email to ${recipient}`}>
            It&apos;s in your Gmail Sent folder. This job is now in <strong>{statusLabel}</strong>.
          </SectionMessage>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (step === "review") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Review and send</DialogTitle>
          <DialogDescription>This is exactly what will be sent. Nothing goes out until you press Send.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          {send.error && (
            <SectionMessage appearance="error" title="The email wasn't sent">
              {errorMessage(send.error)}
            </SectionMessage>
          )}

          <dl className="rounded-sm border border-border text-sm">
            <div className="flex flex-col gap-0.5 border-b border-border px-3 py-2 sm:flex-row sm:gap-2">
              <dt className="w-16 shrink-0 font-semibold text-subtle">From</dt>
              <dd className="break-all">{gmail.data?.googleEmail ?? "Your Gmail account"}</dd>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-border px-3 py-2 sm:flex-row sm:gap-2">
              <dt className="w-16 shrink-0 font-semibold text-subtle">To</dt>
              <dd className="break-all">{recipient}</dd>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-border px-3 py-2 sm:flex-row sm:gap-2">
              <dt className="w-16 shrink-0 font-semibold text-subtle">Subject</dt>
              <dd className="break-words">{draft.subject.trim()}</dd>
            </div>
            {/* Plain text rendered by React (escaped); the server escapes it again for the HTML version */}
            <dd className="max-h-72 overflow-y-auto px-3 py-3 break-words whitespace-pre-wrap">{draft.body}</dd>
          </dl>

          <Checkbox
            id="email-reviewed"
            checked={reviewed}
            onCheckedChange={(checked) => setReviewed(checked === true)}
            disabled={send.isPending}
            label={`I've checked this email and want to send it to ${recipient}`}
            description="Once Gmail accepts it, the email can't be recalled and this job moves to Applied."
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="subtle" onClick={() => setStep("compose")} disabled={send.isPending}>
            <ArrowLeft /> Back to editing
          </Button>
          <Button variant="primary" disabled={!reviewed || !ready || !canSend} isLoading={send.isPending} onClick={confirmAndSend}>
            <Send /> Send now
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form
      noValidate
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        setToTouched(true);
        if (ready && canSend) {
          setReviewed(false);
          send.reset();
          setStep("review");
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Write application email</DialogTitle>
        <DialogDescription>
          {job.title} at {job.company}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4 py-4">
        <GmailNotice gmail={gmail} connect={connectGmail} />

        {sent.data && sent.data.length > 0 && (
          <SectionMessage appearance="information" title="You've already emailed about this job">
            <ul className="flex flex-col gap-0.5">
              {sent.data.slice(0, 3).map((email) => (
                <li key={email.id} className="break-words">
                  To {email.recipient}, {formatRelativeTime(email.sentAt)}
                </li>
              ))}
            </ul>
          </SectionMessage>
        )}

        <Field
          htmlFor="email-template"
          label="Template"
          hint={
            templates.data?.length === 0 ? (
              <>
                No templates yet.{" "}
                <Link href={ROUTES.templates} className="text-link hover:underline">
                  Create one
                </Link>{" "}
                or write the email below.
              </>
            ) : (
              "Switching templates replaces the subject and body below."
            )
          }
        >
          <Select
            id="email-template"
            value={templateId ?? ""}
            disabled={!templates.data || compose.isPending}
            onChange={(e) => loadTemplate(e.target.value || null)}
          >
            {!templateId && <option value="">No template</option>}
            {templates.data?.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.isDefault ? " (default)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        {compose.error && (
          <SectionMessage appearance="error" title="Couldn't fill in the template">
            {errorMessage(compose.error)}
          </SectionMessage>
        )}

        {compose.isPending && !composed ? (
          <div className="flex items-center gap-2 py-6 text-subtle">
            <Spinner /> Filling in the template…
          </div>
        ) : (
          <>
            {remaining.length > 0 && (
              <SectionMessage appearance="warning" title="Fill in the blanks before sending">
                <ul className="flex list-disc flex-col gap-0.5 pl-4">
                  {missingStill.map((field) => (
                    <li key={field.key}>
                      No {field.label.toLowerCase()} available: replace <code className="font-mono">{field.placeholder}</code>{" "}
                      with your own text, or remove it.
                    </li>
                  ))}
                  {otherStill.map((placeholder) => (
                    <li key={placeholder}>
                      <code className="font-mono">{placeholder}</code> isn&apos;t a field CareerPilot can fill: edit or remove it.
                    </li>
                  ))}
                </ul>
              </SectionMessage>
            )}

            <Field
              htmlFor="email-to"
              label="To"
              required
              error={toTouched && !recipientValid ? "Enter one email address, like hr@company.com" : undefined}
              hint="The recruiter or hiring manager. One address."
            >
              <TextField
                id="email-to"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="hr@company.com"
                value={draft.to}
                onChange={(e) => update("to", e.target.value)}
                onBlur={() => setToTouched(true)}
                aria-invalid={toTouched && !recipientValid}
                aria-describedby={toTouched && !recipientValid ? "email-to-error" : undefined}
                maxLength={254}
              />
            </Field>

            <Field htmlFor="email-subject" label="Subject" required>
              <TextField
                id="email-subject"
                value={draft.subject}
                onChange={(e) => update("subject", e.target.value.replace(/[\r\n]+/g, " "))}
                maxLength={255}
              />
            </Field>

            <Field htmlFor="email-body" label="Email" required hint="Changes here apply to this email only, not the template.">
              <Textarea
                id="email-body"
                rows={12}
                className="min-h-56"
                value={draft.body}
                onChange={(e) => update("body", e.target.value)}
                maxLength={20000}
              />
            </Field>
          </>
        )}
      </DialogBody>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="subtle">Cancel</Button>
        </DialogClose>
        <Button type="submit" variant="primary" disabled={!ready || !canSend || compose.isPending}>
          Review email
        </Button>
      </DialogFooter>
    </form>
  );
}

function GmailNotice({
  gmail,
  connect,
}: {
  gmail: ReturnType<typeof useGmailStatus>;
  connect: ReturnType<typeof useConnectGmail>;
}) {
  if (gmail.isPending || gmail.data?.canSend) return null;
  if (gmail.error) {
    return (
      <SectionMessage appearance="error" title="Couldn't check your Gmail connection">
        {errorMessage(gmail.error)}
      </SectionMessage>
    );
  }
  if (!gmail.data.configured) {
    return (
      <SectionMessage appearance="warning" title="Sending isn't available">
        Email sending isn&apos;t set up on this server yet. You can still write the email and copy it.
      </SectionMessage>
    );
  }
  return (
    <SectionMessage
      appearance="warning"
      title={gmail.data.connected ? "Allow CareerPilot to send from your Gmail" : "Connect Gmail to send"}
      actions={
        <Button size="compact" variant="primary" isLoading={connect.isPending} onClick={() => connect.mutate()}>
          {gmail.data.connected ? "Allow sending" : "Connect Gmail"}
        </Button>
      }
    >
      You&apos;ll be taken to Google and brought back here. Your draft isn&apos;t kept, so copy anything you&apos;ve written first.
      {connect.error && <p className="mt-1 text-danger-text">{connect.error.message}</p>}
    </SectionMessage>
  );
}
