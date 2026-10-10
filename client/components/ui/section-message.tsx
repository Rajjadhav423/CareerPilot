import { cva, type VariantProps } from "class-variance-authority";
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Inline message for page-level feedback (Atlassian "Section message"). */
const sectionMessageVariants = cva("flex gap-3 rounded-sm p-4", {
  variants: {
    appearance: {
      information: "bg-information [&_[data-slot=icon]]:text-information-bold",
      success: "bg-success [&_[data-slot=icon]]:text-success-bold",
      warning: "bg-warning [&_[data-slot=icon]]:text-warning-text",
      error: "bg-danger [&_[data-slot=icon]]:text-danger-bold",
    },
  },
  defaultVariants: { appearance: "information" },
});

const icons: Record<NonNullable<SectionMessageProps["appearance"]>, LucideIcon> = {
  information: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
};

type SectionMessageProps = Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof sectionMessageVariants> & {
    title?: React.ReactNode;
    actions?: React.ReactNode;
  };

function SectionMessage({
  className,
  appearance = "information",
  title,
  actions,
  children,
  ...props
}: SectionMessageProps) {
  const Icon = icons[appearance ?? "information"];
  return (
    <div
      data-slot="section-message"
      role={appearance === "error" || appearance === "warning" ? "alert" : "status"}
      className={cn(sectionMessageVariants({ appearance }), className)}
      {...props}
    >
      <Icon data-slot="icon" className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        {children && <div className="text-sm text-foreground">{children}</div>}
        {actions && <div className="mt-1 flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export { SectionMessage, sectionMessageVariants };
