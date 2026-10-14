"use client";

import { useSyncExternalStore } from "react";
import { Monitor } from "lucide-react";

import { getThemePreference, setThemePreference, subscribeToTheme, type ThemePreference } from "@/lib/theme";
import { THEME_OPTIONS } from "@/lib/theme-options";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

/** Light / dark / match browser, in the top bar. The accent colour is in Settings. */
export function ThemeMenu() {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    getThemePreference,
    () => "system" as ThemePreference,
  );
  const CurrentIcon = THEME_OPTIONS.find((o) => o.value === preference)?.icon ?? Monitor;

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
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
