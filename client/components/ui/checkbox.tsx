"use client";

import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  /** Text next to the box; clicking it toggles the box. */
  label?: React.ReactNode;
  /** Smaller, subtler text under the label. */
  description?: React.ReactNode;
};

/** Atlassian-style checkbox with an optional label and description. */
function Checkbox({ className, label, description, id, ...props }: CheckboxProps) {
  const box = (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      id={id}
      className={cn(
        "peer mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-xs border-2 border-border-input bg-input outline-none transition-colors hover:bg-input-hovered focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-inverse pointer-coarse:size-5",
        !label && className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3 stroke-[3]" aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return box;

  return (
    <div className={cn("flex items-start gap-2", className)}>
      {box}
      <label htmlFor={id} className="flex cursor-pointer flex-col text-sm text-foreground select-none">
        {label}
        {description && <span className="text-xs text-subtlest">{description}</span>}
      </label>
    </div>
  );
}

export { Checkbox };
