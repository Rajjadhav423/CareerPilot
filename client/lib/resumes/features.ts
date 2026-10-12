/**
 * Resume version history (History dialog, suggestions to review). Off by default to keep the database small;
 * the backend switch is careerpilot.resumes.versions-enabled. Set NEXT_PUBLIC_RESUME_VERSIONS=true with it.
 */
export const RESUME_VERSIONS_ENABLED = process.env.NEXT_PUBLIC_RESUME_VERSIONS === "true";
