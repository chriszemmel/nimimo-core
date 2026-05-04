import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { routing } from "./routing"

// Messages are plain JSON - values are strings, arrays, or nested
// objects with the same shape. We deep-merge the default-locale
// catalog with the target-locale catalog so a missing key in `de` or
// `zh` falls through to the English version instead of throwing
// `IntlError: MISSING_MESSAGE` or rendering a raw dot-path like
// `recovery.verify.title` in the UI.
//
// This fallback is intentional belt-and-suspenders: `scripts/i18n-check.js`
// also enforces parity in CI (German = 100% of English keys, Chinese =
// 100% of a declared subset), so in a healthy codebase this deep-merge
// is a no-op. The reason it exists anyway is that translation drift is
// a "when, not if" failure mode - a feature flag rolls out new copy,
// a hotfix lands English-only, the i18n check gets skipped under
// pressure - and showing a German user English is always better than
// showing them `recovery.verify.title`.
type MessageShape = Record<string, unknown>

function deepMerge(base: MessageShape, override: MessageShape): MessageShape {
  const out: MessageShape = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const baseValue = out[key]
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      out[key] = deepMerge(baseValue as MessageShape, value as MessageShape)
    } else {
      out[key] = value
    }
  }
  return out
}

// Server-side locale resolver. Called by next-intl for every request
// that renders content under `app/[locale]/...`. If the URL segment is
// missing or unknown, we fall back to the default locale (English).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  // Always load English as the base, then overlay the target-locale
  // catalog on top. Skip the extra import when locale === en since
  // the merge would be an identity operation.
  const base = (await import(`../messages/${routing.defaultLocale}.json`)).default as MessageShape
  const messages =
    locale === routing.defaultLocale
      ? base
      : deepMerge(base, (await import(`../messages/${locale}.json`)).default as MessageShape)

  return {
    locale,
    messages,
  }
})
