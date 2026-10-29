import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/profile-data";

/**
 * Everything here is public and there are three pages, so this allows all
 * rather than pretending to have rules. Its real job is pointing crawlers at
 * the sitemap. (It said "one page" until `/about` and `/play` existed.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteOrigin}/sitemap.xml`,
    host: siteOrigin,
  };
}
