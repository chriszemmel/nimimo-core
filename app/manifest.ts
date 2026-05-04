import type { MetadataRoute } from "next"

/**
 * Web app manifest for nimimo.
 *
 * Enables "Add to Home Screen" / "Install app" on mobile browsers so
 * users can launch nimimo with a single tap from their home screen
 * like a native app - no more typing "nemimo" into Google, scrolling
 * through ads, and copy-pasting the URL. On iOS Safari: Share sheet →
 * "Add to Home Screen". On Android Chrome: the browser auto-prompts
 * once the manifest is seen on visit, and/or menu → "Install app".
 *
 * Keep `display: "standalone"` so the installed shortcut opens without
 * the address bar / tabs, making it feel like a real app. Theme and
 * background colors mirror the dark brand palette used elsewhere in
 * the site (see `app/layout.tsx` viewport themeColor).
 *
 * Icons: we re-use the existing assets rather than shipping more PNG
 * files. Browsers pick the best fit for the target surface - Android
 * home screen, iOS home screen, task switcher, splash screen, etc.
 * The 1000x1000 logo.png easily covers the 192/512 slots Chrome
 * prefers for the install prompt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "nimimo",
    short_name: "nimimo",
    description:
      "Human-readable crypto identity. Receive Bitcoin, Ethereum, and Solana - no custody, no KYC, no seed phrases.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0d2b",
    theme_color: "#0d0d2b",
    categories: ["finance", "productivity", "utilities"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "1000x1000",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
