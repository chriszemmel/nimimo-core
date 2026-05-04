import type { MetadataRoute } from "next"
import { neon } from "@neondatabase/serverless"
import { routing } from "@/i18n/routing"
import { SITE_URL } from "@/lib/site-config"

function withLocales(
  path: string,
  lastModified: Date,
  changeFrequency: "weekly" | "monthly",
  priority: number,
): MetadataRoute.Sitemap[number] {
  const base = SITE_URL
  const defaultUrl = path === "/" ? base : `${base}${path}`
  const languages: Record<string, string> = {}
  for (const locale of routing.locales) {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`
    languages[locale] = path === "/" ? `${base}${prefix || "/"}` : `${base}${prefix}${path}`
  }
  return {
    url: defaultUrl,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const localizedStaticRoutes: MetadataRoute.Sitemap = [
    withLocales("/", now, "weekly", 1),
    withLocales("/docs", now, "monthly", 0.8),
    withLocales("/privacy", now, "monthly", 0.5),
    withLocales("/terms", now, "monthly", 0.5),
  ]

  const englishOnlyStaticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ]

  const staticRoutes = [...localizedStaticRoutes, ...englishOnlyStaticRoutes]

  try {
    const sql = neon(process.env.DATABASE_URL!)

    const [blogRows, handles] = await Promise.all([
      sql`
        SELECT slug, published_at
        FROM blog_posts
        WHERE published_at <= CURRENT_DATE
        ORDER BY published_at DESC
      `,
      sql`
        SELECT handle, created_at
        FROM identities
        ORDER BY created_at DESC
        LIMIT 5000
      `,
    ])

    const blogRoutes: MetadataRoute.Sitemap = blogRows.map((row) => ({
      url: `${SITE_URL}/blog/${row.slug}`,
      lastModified: new Date(row.published_at as string),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))

    const profileRoutes: MetadataRoute.Sitemap = handles.map((row) => ({
      url: `${SITE_URL}/@${row.handle}`,
      lastModified: new Date(row.created_at as string),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }))

    return [...staticRoutes, ...blogRoutes, ...profileRoutes]
  } catch {
    return staticRoutes
  }
}
