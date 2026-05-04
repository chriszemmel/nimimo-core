"use client"

import { useLocale } from "next-intl"
import { usePathname } from "@/i18n/navigation"
import { routing, type Locale } from "@/i18n/routing"

// Minimal language switcher that sits in the footer as a row of tiny
// text links (EN · DE · 中文 · ES), matching the rest of the footer
// link row - `text-[10px] text-muted-foreground/40`. Deliberately NOT
// in the header: the header has enough going on already, and the
// language is a "set once and forget" preference that doesn't need
// to be one tap away on every page.
//
// Uses a hard navigation (`window.location`) instead of client-side
// `router.replace` because the default locale (`en`) has no URL prefix
// under `localePrefix: "as-needed"`. Without a prefix, the middleware
// relies on the `NIMIMO_LOCALE` cookie to decide the locale - and the
// client-side router cache can serve stale RSC payloads from the
// *previous* locale before the cookie propagates. A full page load
// guarantees the middleware sees the correct cookie and returns fresh
// content for every subsequent navigation.
const LABELS: Record<Locale, string> = {
  en: "EN",
  de: "DE",
  zh: "中文",
  es: "ES",
}

export function FooterLanguageSwitcher() {
  const locale = useLocale() as Locale
  const pathname = usePathname()

  const onSelect = (next: Locale) => {
    if (next === locale) return
    document.cookie = `NIMIMO_LOCALE=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax;secure`
    const prefix = next === routing.defaultLocale ? "" : `/${next}`
    window.location.href = `${prefix}${pathname}`
  }

  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          <button
            type="button"
            onClick={() => onSelect(l)}
            aria-current={l === locale ? "true" : undefined}
            className={
              l === locale
                ? "text-muted-foreground/80 font-medium cursor-default"
                : "hover:text-muted-foreground/60 transition-colors cursor-pointer"
            }
          >
            {LABELS[l]}
          </button>
        </span>
      ))}
    </div>
  )
}
