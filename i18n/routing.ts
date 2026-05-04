import { defineRouting } from "next-intl/routing"

// Supported locales.
//
// - `en` (English) - default, no URL prefix. Keeps existing paths working
//   for backlinks, SEO, and the @handle shortcut.
// - `de` (German) - hand-translated, full coverage. This is the reason
//   this whole i18n layer exists: browser auto-translation was breaking
//   the /recovery flow for a German user (see `tasks/lessons.md` →
//   Browser Platform Quirks). Proper hand-translated German removes the
//   user's *reason* to enable browser auto-translate in the first place,
//   and the global `translate="no"` in the root layout stays put as a
//   belt-and-suspenders against the React 19 reconciler crash.
// - `zh` (Chinese, Simplified) - full coverage. Originally landing-only
//   as a CJK proof-of-concept; now hand-translated end-to-end so Chinese
//   users get a fully native experience across the whole product surface.
// - `es` (Spanish) - full coverage, single neutral locale targeting both
//   Latin America and Spain. Uses informal "tú" throughout and prefers
//   LATAM-friendly word choices ("billetera" not "monedero") because the
//   biggest crypto-adoption-by-necessity audiences (Argentina, Venezuela,
//   Mexico, Colombia) live there. nimimo's value prop - non-custodial,
//   no KYC, human-readable handles, recovery-first - lands hardest in
//   exactly those markets, where stablecoin remittances and inflation
//   protection are daily-life use cases rather than speculation.
export const routing = defineRouting({
  locales: ["en", "de", "zh", "es"],
  defaultLocale: "en",
  // `as-needed`: default locale (`en`) has NO prefix, other locales do.
  //   /            → en landing
  //   /wallet      → en wallet
  //   /de          → de landing
  //   /de/wallet   → de wallet
  //   /zh          → zh landing
  //   /es          → es landing
  //   /es/wallet   → es wallet
  // This keeps all current English URLs backwards-compatible - no 301s,
  // no broken backlinks, no SEO churn. Non-English users land on the
  // prefixed variants via middleware-level Accept-Language detection (a
  // 302 on first visit), and their choice persists in a functional cookie.
  localePrefix: "as-needed",
  // Functional cookie (GDPR Art. 5(3) strictly-necessary exempt - it
  // stores nothing more than the user's explicit language preference
  // and is set only *after* the user has been detected or has clicked
  // the switcher, not on anonymous pageloads that stay in the default
  // locale).
  localeCookie: {
    name: "NIMIMO_LOCALE",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    secure: true,
  },
  // Accept-Language-based auto-detection on first visit. The cookie
  // overrides this once the user has picked a language.
  localeDetection: true,
})

export type Locale = (typeof routing.locales)[number]
