/**
 * Site-wide configuration.
 * Toggle features here instead of deleting environment variables.
 */
export const siteConfig = {
  /** Set to false to disable the password protection gate entirely. */
  protectionEnabled: false,
} as const

// Canonical, served-from origin. Vercel serves the app from
// `www.nimimo.com` and 308-redirects the apex `nimimo.com` here, so
// every SEO surface (sitemap, `<link rel="canonical">`, `og:url`,
// `metadataBase`, JSON-LD `url`/`mainEntityOfPage`) MUST use this
// host. Mixing the apex in causes a destructive Googlebot loop:
// sitemap entries redirect (reported as "Page with redirect" in
// Search Console), canonical tags tell Google to prefer a URL that
// itself 308-redirects back, and Google ends up indexing both
// variants of every page and picking one arbitrarily - exactly the
// duplicate apex/www indexing pattern that surfaced in Search Console.
//
// If we ever flip Vercel's primary domain to the apex, change this
// constant to `https://nimimo.com` and the entire SEO surface flips
// with it from a single edit.
export const SITE_URL = "https://www.nimimo.com"
