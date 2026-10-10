import Link from "next/link";

import { cn } from "@/lib/utils";

/** Horizontal page tabs with a blue underline on the active tab (Jira's Summary / Board / List row). */
function Tabs({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="tabs"
      className={cn("flex items-center gap-1 overflow-x-auto border-b border-border", className)}
      {...props}
    />
  );
}

type TabProps = {
  href: string;
  active?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

function Tab({ href, active = false, disabled = false, icon, children, className }: TabProps) {
  const classes = cn(
    "relative flex h-10 shrink-0 items-center gap-2 rounded-t-sm px-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-focus [&_svg]:size-4",
    "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
    active
      ? "text-selected-text after:bg-brand"
      : "text-subtle hover:text-foreground hover:after:bg-border-bold",
    disabled && "pointer-events-none text-disabled",
    className,
  );

  if (disabled) {
    return (
      <span data-slot="tab" aria-disabled className={classes}>
        {icon}
        {children}
      </span>
    );
  }

  return (
    <Link data-slot="tab" href={href} aria-current={active ? "page" : undefined} className={classes}>
      {icon}
      {children}
    </Link>
  );
}

export { Tabs, Tab };
