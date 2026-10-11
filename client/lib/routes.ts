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
  resumeNew: "/dashboard/resumes/new",
  documents: "/dashboard/documents",
  settings: "/dashboard/settings",
} as const;

/** Editor page of one saved resume. */
export const resumePath = (id: string) => `/dashboard/resumes/${encodeURIComponent(id)}`;
