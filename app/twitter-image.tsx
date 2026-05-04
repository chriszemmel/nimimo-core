// Re-export the OG image for Twitter/X cards.
// Next.js does not auto-copy og:image to twitter:image - without this file
// `summary_large_image` tweets render as a blank card. Mirrors the pattern
// used by `app/[locale]/[handle]/twitter-image.tsx`.
export { default, alt, size, contentType } from "./opengraph-image"
