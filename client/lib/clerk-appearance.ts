/**
 * Makes Clerk's sign-in/sign-up/user menu look like the rest of CareerPilot.
 * Values are our design tokens (app/globals.css), so light/dark switching just works.
 * Clerk styles live in the "clerk" CSS layer, which globals.css orders before Tailwind utilities.
 */
export const clerkAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "var(--brand)",
    colorPrimaryForeground: "var(--text-inverse)",
    colorBackground: "var(--surface-raised)",
    colorForeground: "var(--text)",
    colorMutedForeground: "var(--text-subtle)",
    colorMuted: "var(--surface-sunken)",
    colorInput: "var(--input)",
    colorInputForeground: "var(--text)",
    colorBorder: "var(--border)",
    colorRing: "var(--border-focused)",
    colorNeutral: "var(--text)",
    colorDanger: "var(--danger-bold)",
    colorSuccess: "var(--success-bold)",
    colorWarning: "var(--warning-bold)",
    colorShadow: "rgba(9, 30, 66, 0.25)",
    colorModalBackdrop: "rgba(9, 30, 66, 0.54)",
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "6px",
  },
  elements: {
    // Our auth layout already shows the CareerPilot logo above the card.
    logoBox: "hidden",
    card: "shadow-raised",
    // Same visible input border as our own TextField.
    formFieldInput: "border border-border-input",
    footer: "bg-surface-sunken",
  },
} as const;
