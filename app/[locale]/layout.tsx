import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import { SessionProvider } from "@/components/session-provider"
import { OwnershipProvider } from "@/components/ownership-provider"
import { QueryProvider } from "@/components/query-provider"
import { Toaster } from "@/components/ui/toaster"
import { cookies, headers } from "next/headers"
import { notFound } from "next/navigation"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { siteConfig, SITE_URL } from "@/lib/site-config"
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/lib/og-metadata"
import { AppHeaderWrapper } from "@/components/app-header-wrapper"
import Script from "next/script"
import "../globals.css"

const inter = localFont({
  src: "../../public/fonts/inter-latin.woff2",
  variable: "--font-inter",
  display: "swap",
})

const outfit = localFont({
  src: "../../public/fonts/outfit-latin.woff2",
  variable: "--font-outfit",
  display: "swap",
})

const vt323 = localFont({
  src: "../../public/fonts/vt323-latin.woff2",
  weight: "400",
  variable: "--font-pixel",
  display: "swap",
  // VT323 is only used by the `retro` profile template (see
  // components/profile/templates/template-retro.tsx) - it's never on
  // the landing page or any core app surface. Auto-preloading it on
  // every route wastes a request and trips Chrome's "preloaded but
  // not used within a few seconds" console warning. The font still
  // loads on-demand when a retro profile is rendered, via
  // `font-display: swap`, so users of that template see no
  // regression.
  preload: false,
})

// Pre-render every locale at build time. Without this, the
// `[locale]` segment is treated as dynamic and Suspense boundaries
// around async server components end up bailing out of static
// generation.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata" })

  // hreflang alternates: one entry per supported locale so Google,
  // Bing, and the AI crawlers can discover every translation.
  // `x-default` points at the unprefixed English URL, matching our
  // `localePrefix: 'as-needed'` routing strategy.
  const languages: Record<string, string> = {
    "x-default": `${SITE_URL}/`,
  }
  for (const l of routing.locales) {
    languages[l] = l === routing.defaultLocale ? `${SITE_URL}/` : `${SITE_URL}/${l}`
  }

  const canonical =
    locale === routing.defaultLocale ? SITE_URL : `${SITE_URL}/${locale}`

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("titleDefault"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    keywords: [
      "crypto identity",
      "crypto wallet",
      "receive bitcoin",
      "receive ethereum",
      "receive solana",
      "non-custodial wallet",
      "human-readable crypto address",
      "nimimo",
      "Chris Zemmel",
    ],
    authors: [{ name: "Chris Zemmel", url: `${SITE_URL}/about` }],
    creator: "Chris Zemmel",
    generator: "nimimo",
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-icon.png",
    },
    // Enable full-screen standalone mode when the site is launched from
    // the iOS home screen shortcut ("Add to Home Screen"). Without this
    // Safari opens the PWA with its own browser chrome visible, which
    // defeats the point of the shortcut. The Android equivalent is
    // driven by the `display: "standalone"` field in app/manifest.ts.
    appleWebApp: {
      capable: true,
      title: "nimimo",
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      type: "website",
      siteName: "nimimo",
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: canonical,
      locale: locale === "en" ? "en_US" : locale === "de" ? "de_DE" : "zh_CN",
      images: DEFAULT_OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("twitterDescription"),
      images: DEFAULT_TWITTER_IMAGES,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    alternates: {
      canonical,
      languages,
    },
  }
}

export const viewport: Viewport = {
  colorScheme: "dark",
  // Resize the layout viewport (not just the visual viewport) when the
  // virtual keyboard opens. Without this, mobile Chromium browsers (e.g.
  // Brave on Android) leave the layout viewport at full height while the
  // visual viewport shrinks, which makes our fixed app-header float/jump
  // and fights the browser's "scroll focused input into view" logic -
  // producing a visible glitch when focusing the input or tapping Done
  // inside flows like /settings/handle.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d0d2b" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d2b" },
  ],
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  // Required so the server components rendered beneath this layout
  // can synchronously read the current locale via `getTranslations()`
  // without awaiting `requestLocale`.
  setRequestLocale(locale)

  const headerStore = await headers()
  const nonce = headerStore.get("x-nonce") ?? ""
  const cookieStore = await cookies()
  const isProtectionAuthenticated = cookieStore.get("protection-auth")?.value === "authenticated"
  const protectionEnabled = siteConfig.protectionEnabled && !!process.env.PROTECTION_PASSWORD

  return (
    <html lang={locale} translate="no" suppressHydrationWarning className="dark">
      <head>
        {/* Disable browser auto-translation site-wide.
            Why: Chrome on Android (and Edge) auto-translate English pages to
            the device language. Their engines asynchronously rewrite text
            nodes in the live DOM, which conflicts with React 19's reconciler
            when state-driven re-renders touch the same nodes - the reconciler
            throws `NotFoundError: Failed to execute 'removeChild' on 'Node'`
            and the global error boundary catches it as "Something went wrong".
            This was breaking the /recovery flow for a user on Chrome Android
            with German as the system language: the button text was being
            re-rendered while Chrome had already swapped it for a translation.
            Beyond the bug, auto-translating a crypto flow is independently
            unsafe - "wallet", "send", "recover", etc. have precise meanings
            that machine translation can mangle.

            As of v1.2.0 nimimo ships in proper hand-translated German (and
            Chinese on the landing page), so users have no *reason* to enable
            browser auto-translation - but we keep the hard-block in place
            because (a) the React 19 reconciler crash is independent of
            translation quality, (b) a user could still force-translate one
            of the untranslated pages (admin, audit, architecture, blog post
            bodies), and (c) we can't prevent users from right-clicking and
            asking for a machine translation. Users who deliberately translate
            accept the risk; we just don't do it *for* them.
            See facebook/react#11538. */}
        <meta name="google" content="notranslate" />
        {/* Point LLM crawlers at the curated corpus. /llms.txt is the
            short index; /llms-full.txt is the full architectural and
            positioning corpus in one fetch. */}
        <link rel="llms" href="/llms.txt" />
        <link rel="alternate" type="text/markdown" href="/llms-full.txt" />
        <Script
          id="scroll-reset"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              if ('scrollRestoration' in history) {
                history.scrollRestoration = 'manual';
              }
              window.addEventListener('load', function() {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
              });
              window.scrollTo(0, 0);
              document.documentElement.scrollTop = 0;
              document.body.scrollTop = 0;
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${outfit.variable} ${vt323.variable} font-sans antialiased bg-background text-foreground`}>
        <NextIntlClientProvider>
          {!protectionEnabled || isProtectionAuthenticated ? (
            <QueryProvider>
              <SessionProvider>
                <OwnershipProvider>
                  <AppHeaderWrapper />
                  <div className="pt-14">{children}</div>
                  <Toaster />
                </OwnershipProvider>
              </SessionProvider>
            </QueryProvider>
          ) : (
            children
          )}
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
