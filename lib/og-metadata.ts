// Default OG/Twitter image config for pages that override the
// site-wide openGraph metadata in their own `generateMetadata`.
//
// Next.js does NOT merge parent-segment openGraph with child-segment
// openGraph field-by-field - defining openGraph at all in a child
// REPLACES the parent's entirely. So every page that customizes
// og:title / og:description / og:url etc. must also explicitly
// include `images`, otherwise the landing OG card silently
// disappears from that page's social previews across every surface
// (X, Facebook, WhatsApp, LinkedIn, Discord, iMessage, Slack).
//
// Per-handle pages at `app/[locale]/[handle]/` are the exception:
// they colocate their own `opengraph-image.tsx` with their
// `generateMetadata`, and Next.js picks up the file-convention
// images automatically within the same segment.
//
// The URLs point at the file-based routes at `app/opengraph-image.tsx`
// and `app/twitter-image.tsx`. `proxy.ts` exempts both paths from the
// next-intl rewrite so scrapers can reach the PNGs at
// `https://nimimo.com/opengraph-image` and `/twitter-image` directly.

export const DEFAULT_OG_IMAGES = [
  {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: "nimimo - Receive crypto in seconds",
    type: "image/png",
  },
]

export const DEFAULT_TWITTER_IMAGES = [
  {
    url: "/twitter-image",
    width: 1200,
    height: 630,
    alt: "nimimo - Receive crypto in seconds",
  },
]
