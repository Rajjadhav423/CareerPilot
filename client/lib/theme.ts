export type ThemePreference = "light" | "dark" | "system";

export const ACCENTS = ["blue", "purple", "teal", "green", "magenta"] as const;
export type Accent = (typeof ACCENTS)[number];

const THEME_KEY = "careerpilot-theme";
const ACCENT_KEY = "careerpilot-accent";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the page paints, so there is no flash of the wrong theme or accent.
 * Keep it in sync with applyTheme() / applyAccent() below.
 */
export const themeInitScript = `(function(){try{var e=document.documentElement;var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("${DARK_QUERY}").matches);e.dataset.theme=d?"dark":"light";var a=localStorage.getItem("${ACCENT_KEY}");if(a)e.dataset.accent=a}catch(x){}})()`;

const listeners = new Set<() => void>();

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the change still applies for this page view.
  }
}

export function getThemePreference(): ThemePreference {
  const value = read(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function getAccent(): Accent {
  const value = read(ACCENT_KEY);
  return ACCENTS.includes(value as Accent) ? (value as Accent) : "blue";
}

function applyTheme(preference: ThemePreference) {
  const dark =
    preference === "dark" || (preference === "system" && matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setThemePreference(preference: ThemePreference) {
  write(THEME_KEY, preference === "system" ? null : preference);
  applyTheme(preference);
  listeners.forEach((listener) => listener());
}

export function setAccent(accent: Accent) {
  write(ACCENT_KEY, accent === "blue" ? null : accent);
  if (accent === "blue") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore: notifies on theme/accent changes and follows the OS while on "system". */
export function subscribeToTheme(listener: () => void) {
  listeners.add(listener);
  const media = matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    if (getThemePreference() === "system") applyTheme("system");
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}
