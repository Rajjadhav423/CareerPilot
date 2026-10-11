import type { MetadataRoute } from "next";

import { ROUTES } from "@/lib/routes";

/** Public pages may be indexed; the signed-in app may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [ROUTES.dashboard] },
  };
}
