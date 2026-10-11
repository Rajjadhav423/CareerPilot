/** Every page path in one place. Public pages at the root, the signed-in app under /dashboard. */
export const ROUTES = {
  home: "/",
  privacy: "/privacy",
  terms: "/terms",
  signIn: "/sign-in",
  signUp: "/sign-up",

  dashboard: "/dashboard",
  discover: "/dashboard/discover",
  jobs: "/dashboard/jobs",
  jobsList: "/dashboard/jobs/list",
  templates: "/dashboard/templates",
  profile: "/dashboard/profile",
  resumes: "/dashboard/resumes",
  settings: "/dashboard/settings",
} as const;
