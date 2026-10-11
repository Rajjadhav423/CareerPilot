/**
 * Only links to Google's own Drive/Docs pages are rendered as clickable. The value comes from Google via our
 * API, but checking it keeps a malformed or unexpected value from becoming a link in the app.
 */
export function safeDriveLink(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === "drive.google.com" || url.hostname === "docs.google.com";
    return url.protocol === "https:" && allowedHost ? url.toString() : null;
  } catch {
    return null;
  }
}
