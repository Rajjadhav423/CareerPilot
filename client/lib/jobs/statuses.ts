import type { VariantProps } from "class-variance-authority";

import type { lozengeVariants } from "@/components/ui/lozenge";

type LozengeAppearance = NonNullable<VariantProps<typeof lozengeVariants>["appearance"]>;

/** Job application statuses from the project reference doc (Phase 1). Order = board column order. */
export const JOB_STATUSES = [
  { id: "SAVED", label: "Saved", appearance: "default" },
  { id: "TO_REVIEW", label: "To review", appearance: "new" },
  { id: "PREPARING", label: "Preparing", appearance: "inprogress" },
  { id: "APPLIED", label: "Applied", appearance: "inprogress" },
  { id: "INTERVIEW", label: "Interview", appearance: "moved" },
  { id: "OFFER", label: "Offer", appearance: "success" },
  { id: "REJECTED", label: "Rejected", appearance: "removed" },
  { id: "CLOSED", label: "Closed", appearance: "default" },
] as const satisfies readonly { id: string; label: string; appearance: LozengeAppearance }[];

export type JobStatus = (typeof JOB_STATUSES)[number]["id"];
