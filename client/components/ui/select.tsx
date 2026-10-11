import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Native select styled like TextField. Native = the phone's own picker on mobile and full keyboard
 * support everywhere, which suits simple option lists.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div data-slot="select" className={cn("relative", className)}>
      <select
        className="h-8 w-full appearance-none rounded-sm border border-border-input bg-input pr-8 pl-2 text-sm text-foreground transition-colors outline-none hover:bg-input-hovered focus:border-focus focus:ring-1 focus:ring-focus pointer-coarse:h-10 pointer-coarse:text-base"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-subtle"
        aria-hidden
      />
    </div>
  );
}

export { Select };
