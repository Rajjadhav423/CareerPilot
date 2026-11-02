import type { EmailTrackingStatus, SentEmail } from "@/lib/api/application-emails";
import { formatRelativeTime } from "@/lib/format";
import { Lozenge } from "@/components/ui/lozenge";

const APPEARANCE = {
  REPLIED: "success",
  BOUNCED: "removed",
  OPENED: "new",
  DELIVERED: "inprogress",
  SENT: "default",
} as const satisfies Record<EmailTrackingStatus, string>;

const LABEL: Record<EmailTrackingStatus, string> = {
  REPLIED: "Replied",
  BOUNCED: "Bounced",
  OPENED: "Opened",
  DELIVERED: "Delivered",
  SENT: "Sent",
};

/** One line explaining the status, e.g. "Opened 3 times, last 2 hours ago". */
export function describeEmailStatus(email: SentEmail): string {
  const parts: string[] = [];
  if (email.replyCount > 0) {
    parts.push(`${email.replyCount === 1 ? "Replied" : `${email.replyCount} replies, first`} ${formatRelativeTime(email.repliedAt)}`);
  }
  if (email.deliveryStatus === "BOUNCED") parts.push(`Bounced ${formatRelativeTime(email.bouncedAt)}: the address didn't accept it`);
  if (email.openCount > 0) {
    parts.push(`Opened ${email.openCount === 1 ? "once" : `${email.openCount} times`}, last ${formatRelativeTime(email.lastOpenedAt)}`);
  } else if (email.openTracked && email.deliveryStatus !== "BOUNCED") {
    parts.push("Not opened yet (or images are blocked)");
  }
  if (email.deliveryStatus === "DELIVERED" && email.replyCount === 0 && email.openCount === 0) parts.push("No bounce came back");
  if (!email.checkedAt) parts.push("Allow reply tracking to see bounces and replies");
  return parts.join(" · ");
}

export function EmailStatusLozenge({ email }: { email: SentEmail }) {
  return (
    <Lozenge appearance={APPEARANCE[email.status]} title={describeEmailStatus(email)}>
      {LABEL[email.status]}
    </Lozenge>
  );
}
