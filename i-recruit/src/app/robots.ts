import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // Preview builds set NEXT_PUBLIC_NOINDEX=1 so search engines skip them.
  if (process.env.NEXT_PUBLIC_NOINDEX === "1") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${siteUrl()}/sitemap.xml` };
}
