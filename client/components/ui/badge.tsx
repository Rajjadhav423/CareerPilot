import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Small count badge, e.g. the number next to a board column title. */
const badgeVariants = cva(
  "inline-flex h-4 min-w-5 items-center justify-center rounded-xs px-1 text-xs leading-4 font-normal tabular-nums",
  {
    variants: {
      appearance: {
        default: "bg-neutral text-foreground",
        primary: "bg-brand text-inverse",
        important: "bg-danger-bold text-inverse",
        added: "bg-success text-success-text",
        removed: "bg-danger text-danger-text",
      },
    },
    defaultVariants: { appearance: "default" },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, appearance, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ appearance }), className)} {...props} />;
}

export { Badge, badgeVariants };
