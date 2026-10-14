import { Monitor, Moon, Sun } from "lucide-react";

import type { Accent, ThemePreference } from "@/lib/theme";

/** Theme choices, shared by the top-bar menu and Settings. */
export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match browser", icon: Monitor },
];

/** Swatch colours are the light-theme brand value of each accent (see globals.css). */
export const ACCENT_OPTIONS: { value: Accent; label: string; swatch: string }[] = [
  { value: "blue", label: "Blue", swatch: "#1868db" },
  { value: "purple", label: "Purple", swatch: "#964ac0" },
  { value: "teal", label: "Teal", swatch: "#227d9b" },
  { value: "green", label: "Green", swatch: "#1f845a" },
  { value: "magenta", label: "Magenta", swatch: "#ae4787" },
];
