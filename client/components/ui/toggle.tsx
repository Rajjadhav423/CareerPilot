"use client";

import { Check, X } from "lucide-react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type ToggleProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  /** Text next to the toggle; clicking it switches the toggle. */
  label?: React.ReactNode;
};

/**
 * Atlassian-style toggle: a pill track with a check (on) or cross (off) and a sliding knob. Use for settings that
 * take effect immediately; use a checkbox in forms that are submitted.
 */
function Toggle({ className, label, id, ...props }: ToggleProps) {
  const toggle = (
    <SwitchPrimitive.Root
      data-slot="toggle"
      id={id}
      className={cn(
        "group relative inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full bg-neutral-bold outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
        "data-[state=checked]:bg-success-bold disabled:pointer-events-none disabled:opacity-50",
        "pointer-coarse:h-5 pointer-coarse:w-10",
        !label && className,
      )}
      {...props}
    >
      <Check className="absolute left-1 size-2.5 stroke-[3] text-inverse opacity-0 group-data-[state=checked]:opacity-100" aria-hidden />
      <X className="absolute right-1 size-2.5 stroke-[3] text-inverse group-data-[state=checked]:opacity-0" aria-hidden />
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-3 translate-x-0.5 rounded-full bg-surface shadow-raised transition-transform",
          "data-[state=checked]:translate-x-[1.125rem]",
          "pointer-coarse:size-4 pointer-coarse:data-[state=checked]:translate-x-[1.375rem]",
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return toggle;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {toggle}
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground select-none">
        {label}
      </label>
    </div>
  );
}

export { Toggle };
