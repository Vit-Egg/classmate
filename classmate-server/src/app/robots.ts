import type { MetadataRoute } from "next";

/** Soukromá aplikace jedné třídy: vyhledávače nesmí indexovat nic. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
