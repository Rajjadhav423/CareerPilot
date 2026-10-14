"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";

import { getAccent, setAccent, subscribeToTheme, type Accent } from "@/lib/theme";
import { ACCENT_OPTIONS } from "@/lib/theme-options";
import { cn } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Accent colour (light/dark is switched from the top bar). Saved in this browser and applied at once. */
export function AppearanceSettings() {
  const accent = useSyncExternalStore(subscribeToTheme, getAccent, () => "blue" as Accent);

  return (
    <Card className="gap-4 p-4 @md:p-5">
      <CardHeader className="p-0">
        <div className="min-w-0">
          <CardTitle>Accent colour</CardTitle>
          <CardDescription className="mt-1">
            Buttons, links, selections and focus rings use it. Saved in this browser and applied straight away.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
        {ACCENT_OPTIONS.map(({ value, label, swatch }) => {
          const selected = accent === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setAccent(value)}
              className={cn(
                "flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                "pointer-coarse:min-h-11",
                selected ? "border-border-selected bg-selected text-selected-text" : "border-border bg-surface hover:bg-surface-hovered",
              )}
            >
              {/* The swatch shows the accent itself, so it's the one place a literal colour belongs */}
              <span aria-hidden className="size-4 rounded-full" style={{ backgroundColor: swatch }} />
              {label}
              {selected && <Check className="size-4" aria-hidden />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
