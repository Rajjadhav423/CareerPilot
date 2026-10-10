import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Small uppercase status label, like Jira's issue status badges.
 * appearance: default (grey), inprogress (blue), success (green), removed (red),
 * moved (yellow), new (purple). `isBold` gives the solid version.
 */
const lozengeVariants = cva(
  "inline-flex h-4 max-w-full items-center rounded-xs px-1 text-[11px] font-bold uppercase leading-4 whitespace-nowrap",
  {
    variants: {
      appearance: {
        default: "",
        inprogress: "",
        success: "",
        removed: "",
        moved: "",
        new: "",
      },
      isBold: { true: "", false: "" },
    },
    compoundVariants: [
      { appearance: "default", isBold: false, className: "bg-neutral text-subtle" },
      { appearance: "inprogress", isBold: false, className: "bg-information text-information-text" },
      { appearance: "success", isBold: false, className: "bg-success text-success-text" },
      { appearance: "removed", isBold: false, className: "bg-danger text-danger-text" },
      { appearance: "moved", isBold: false, className: "bg-warning text-warning-text" },
      { appearance: "new", isBold: false, className: "bg-discovery text-discovery-text" },
      { appearance: "default", isBold: true, className: "bg-neutral-bold text-inverse" },
      { appearance: "inprogress", isBold: true, className: "bg-information-bold text-inverse" },
      { appearance: "success", isBold: true, className: "bg-success-bold text-inverse" },
      { appearance: "removed", isBold: true, className: "bg-danger-bold text-inverse" },
      { appearance: "moved", isBold: true, className: "bg-warning-bold text-warning-inverse" },
      { appearance: "new", isBold: true, className: "bg-discovery-bold text-inverse" },
    ],
    defaultVariants: { appearance: "default", isBold: false },
  },
);

type LozengeProps = React.ComponentProps<"span"> & VariantProps<typeof lozengeVariants>;

function Lozenge({ className, appearance, isBold, children, ...props }: LozengeProps) {
  return (
    <span
      data-slot="lozenge"
      className={cn(lozengeVariants({ appearance, isBold }), className)}
      {...props}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export { Lozenge, lozengeVariants };
