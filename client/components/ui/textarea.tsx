import { cn } from "@/lib/utils";

/** Multi-line input matching TextField. 16px text on touch devices (prevents iOS zoom). */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full resize-y rounded-sm border border-border-input bg-input px-2 py-1.5 text-sm text-foreground transition-colors outline-none placeholder:text-subtlest hover:bg-input-hovered focus:border-focus focus:ring-1 focus:ring-focus aria-invalid:border-danger-bold pointer-coarse:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
