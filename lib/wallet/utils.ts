/**
 * Format a timestamp as a human-readable relative time, localized to
 * the given locale. Uses native `Intl.RelativeTimeFormat` (supported
 * in every browser nimimo targets) so "2 hours ago" becomes "vor 2
 * Stunden" under `/de` and "2 小时前" under `/zh` automatically -
 * no per-locale string catalog needed.
 *
 * Thresholds:
 *   ≤ 10s         → "just now" ("gerade eben" / "刚刚")
 *   < 60s         → "N seconds ago"
 *   < 60m         → "N minutes ago"
 *   < 24h         → "N hours ago"
 *   < 48h         → "yesterday" ("gestern" / "昨天")
 *   otherwise     → localized date (DD/MM/YYYY in EU, MM/DD/YYYY in US, etc.)
 *
 * Callers must pass the active locale - typically via
 * `useLocale()` from next-intl in client components. Server
 * components can get it from `getLocale()` or the `[locale]` route
 * segment. `formatRelativeTime(ts)` without a locale falls back to
 * the runtime default, which is not what we want in a multilingual
 * app, so the locale arg is intentionally required.
 */
export function formatRelativeTime(timestamp: number, locale: string): string {
  const now = Date.now()
  // A non-finite timestamp (NaN / Infinity) - an unconfirmed tx with no
  // block time yet, or a malformed value from a flaky RPC - would make
  // `Intl.RelativeTimeFormat` / `Intl.DateTimeFormat` below throw a
  // RangeError. That throw bubbles to the route error boundary and blanks
  // the entire wallet ("Something went wrong"). Treat an unknown time as
  // "now": a freshly-broadcast transfer is, in practice, just-happened, so
  // it's the least-surprising label and keeps the render crash-proof.
  const ts = Number.isFinite(timestamp) ? timestamp : now
  const diff = now - ts
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  // "just now" - bucket anything within 10 seconds into the same
  // `Intl.RelativeTimeFormat` output as "0 seconds ago", which the
  // numeric: "auto" flag renders as "now" / "jetzt" / "现在" etc.
  if (seconds <= 10) {
    return rtf.format(0, "second")
  }

  if (seconds < 60) {
    return rtf.format(-seconds, "second")
  }

  if (minutes < 60) {
    return rtf.format(-minutes, "minute")
  }

  if (hours < 24) {
    return rtf.format(-hours, "hour")
  }

  // "yesterday" - `numeric: "auto"` turns `-1, "day"` into the
  // locale's word for "yesterday" rather than "1 day ago".
  if (hours < 48) {
    return rtf.format(-1, "day")
  }

  // Older than 2 days → show a locale-formatted absolute date.
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(ts))
}

/**
 * Convert a chain "block time" (seconds since epoch, as returned by Solana's
 * `getSignaturesForAddress` or a Bitcoin block) into epoch milliseconds.
 *
 * RPCs return `null` for a just-confirmed transaction whose block time
 * hasn't been computed yet, and a misbehaving/fallback endpoint can return a
 * non-numeric value. Either way the safe answer is "now": the only callers
 * are transaction lists where an unknown time means the entry is brand new.
 * Returning `Date.now()` instead of `NaN` keeps a malformed value from
 * reaching `formatRelativeTime` and crashing the wallet render.
 */
export function blockTimeToMs(blockTimeSeconds: unknown): number {
  const n = Number(blockTimeSeconds)
  return Number.isFinite(n) && n > 0 ? n * 1000 : Date.now()
}
