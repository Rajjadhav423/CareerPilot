"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import {
  getAccent,
  getThemePreference,
  setAccent,
  setThemePreference,
  subscribeToTheme,
  type Accent,
  type ThemePreference,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match browser", icon: Monitor },
] as const;

/** Swatch colours are the light-theme brand value of each accent (see globals.css). */
const accentOptions: { value: Accent; label: string; swatch: string }[] = [
  { value: "blue", label: "Blue", swatch: "#1868db" },
  { value: "purple", label: "Purple", swatch: "#964ac0" },
  { value: "teal", label: "Teal", swatch: "#227d9b" },
  { value: "green", label: "Green", swatch: "#1f845a" },
  { value: "magenta", label: "Magenta", swatch: "#ae4787" },
];

export function ThemeMenu() {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    getThemePreference,
    () => "system" as ThemePreference,
  );
  const accent = useSyncExternalStore(subscribeToTheme, getAccent, () => "blue" as Accent);
  const CurrentIcon = themeOptions.find((o) => o.value === preference)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <Tooltip content="Theme">
        <DropdownMenuTrigger asChild>
          <Button variant="subtle" size="icon" aria-label="Change theme">
            <CurrentIcon />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="w-52">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setThemePreference(value as ThemePreference)}
        >
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Accent colour</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={accent} onValueChange={(value) => setAccent(value as Accent)}>
          {accentOptions.map(({ value, label, swatch }) => (
            <DropdownMenuRadioItem key={value} value={value} onSelect={(e) => e.preventDefault()}>
              <span aria-hidden className="size-4 rounded-full" style={{ backgroundColor: swatch }} />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
