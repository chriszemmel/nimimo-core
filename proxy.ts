import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import createIntlMiddleware from "next-intl/middleware"
import { routing } from "@/i18n/routing"
import { siteConfig } from "@/lib/site-config"

// next-intl locale routing - handles Accept-Language detection,
// cookie persistence, and the `/de`, `/zh` URL prefixes. Runs for
// page requests only (not API routes, static assets, @handle
// shortcuts, or the protection gate).
const intlMiddleware = createIntlMiddleware(routing)

// --- CSRF: Mutation methods that require Origin validation ---
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

// --- Rate limiting (Upstash Redis) ---

const redis = new Redis({
  url: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim(),
  token: (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim(),
})

const strictLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "rl:strict",
  analytics: true,
})

const standardLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "rl:standard",
  analytics: true,
})

const relaxedLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  prefix: "rl:relaxed",
  analytics: true,
})

const strictRoutes = [
  "/api/identity/assign",
  "/api/wallet/broadcast",
  "/api/wallet/broadcast-eth",
  "/api/wallet/broadcast-btc",
]

const standardRoutes = [
  "/api/addresses/store",
  "/api/addresses/get",
  "/api/addresses/balances",
  "/api/user/check-returning",
  "/api/wallet/validate-address",
  "/api/wallet/utxos",
  "/api/wallet/eth-tx-params",
  "/api/identity/lookup",
  "/api/identity/by-address",
  "/api/identity/by-addresses",
  "/api/v1/resolve",
  "/api/v1/intents",
]

function getRateLimiter(pathname: string) {
  if (strictRoutes.some((r) => pathname.startsWith(r))) return strictLimit
  if (standardRoutes.some((r) => pathname.startsWith(r))) return standardLimit
  return relaxedLimit
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // --- @handle routing: /@handle → rewrite to /<locale>/handle with marker header ---
  //
  // Also matches `/de/@handle`, `/zh/@handle`, and `/es/@handle` so a
  // non-English user following a shared profile link still lands on
  // the profile (via the locale-aware [handle] route) instead of a 404.
  // The rewrite strips the `@` but preserves the locale prefix.
  //
  // Critical gotcha: v1.2.0 moved profile routes from `app/[handle]/
  // page.tsx` to `app/[locale]/[handle]/page.tsx` (two segments), but
  // the unprefixed default-locale case (`/@chris`) was still being
  // rewritten to `/chris` (one segment), which does not match
  // `[locale]/[handle]` and fell through to the root `app/not-found.tsx`.
  // That silently broke every canonical profile share URL (the exact
  // URLs the sitemap, OG cards, and the in-app "copy link" flow hand
  // out) for every visitor who wasn't already on `/de` or `/zh`.
  //
  // Fix: always prefix the rewrite destination with a locale - use the
  // captured prefix if present, otherwise the default locale. The
  // user-visible URL stays `/@chris` because this is an internal
  // rewrite, not a redirect. We also add `es` to the captured-locale
  // alternation so `/es/@chris` doesn't fall through to the next-intl
  // branch and 404 a different way.
  //
  // @handle URLs themselves are locale-agnostic - the profile body is
  // user-generated content and doesn't need translation, only the UI
  // chrome does, which next-intl picks up from the locale segment we
  // inject here.
  const atHandleMatch = pathname.match(
    /^(?:\/(de|zh|es))?\/@([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/,
  )
  if (atHandleMatch) {
    const [, localePrefix, handle] = atHandleMatch
    const url = request.nextUrl.clone()
    url.pathname = `/${localePrefix ?? routing.defaultLocale}/${handle}`
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-nimimo-at-route", "1")
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    })
  }

  // --- CSRF: Validate Origin on mutation API requests ---
  if (pathname.startsWith("/api/") && MUTATION_METHODS.has(request.method)) {
    // Skip CSRF for NextAuth routes (has its own CSRF protection)
    if (!pathname.startsWith("/api/auth/")) {
      const origin = request.headers.get("origin")
      const host = request.headers.get("host")

      if (origin && host) {
        try {
          const originHost = new URL(origin).host
          if (originHost !== host) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
          }
        } catch {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      } else if (!origin) {
        // No Origin header - likely a non-browser client or same-origin navigation.
        // SameSite cookies prevent cross-origin cookie attachment, so this is safe.
      }
    }
  }

  // --- Rate-limit API routes ---
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
    const limiter = getRateLimiter(request.nextUrl.pathname)
    const { success, limit, reset, remaining } = await limiter.limit(ip)

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
            "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Limit", limit.toString())
    response.headers.set("X-RateLimit-Remaining", remaining.toString())
    response.headers.set("X-RateLimit-Reset", reset.toString())
    return response
  }

  // --- CSP nonce: Generate per-request nonce for page routes ---
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.r2.dev",
    "connect-src 'self' https://accounts.google.com https://*.neondb.tech https://blockstream.info https://api.blockcypher.com https://*.alchemy.com https://1rpc.io https://cloudflare-eth.com https://api.mainnet-beta.solana.com https://rpc.ankr.com https://*.bitcoin-mainnet.g.alchemy.com",
    "worker-src 'self' blob:",
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ")

  // Pass nonce to pages via request header (readable via headers() in server components)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  // Check if site protection is enabled
  const protectionPassword = siteConfig.protectionEnabled ? process.env.PROTECTION_PASSWORD : undefined

  // If protection is enabled but the user isn't yet authenticated, the
  // protection gate takes precedence over i18n routing - we don't want
  // to 302 to `/de` *before* the user has unlocked the site.
  if (protectionPassword) {
    const isAuthenticated = request.cookies.get("protection-auth")?.value === "authenticated"

    if (pathname === "/protection") {
      if (isAuthenticated) {
        return NextResponse.redirect(new URL("/", request.url))
      }
      const response = NextResponse.next({ request: { headers: requestHeaders } })
      response.headers.set("Content-Security-Policy", cspHeader)
      return response
    }

    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/protection", request.url))
    }
  }

  // --- next-intl locale routing ---
  //
  // At this point: we're on a page route, not an API route, the
  // protection gate (if any) has been passed, and @handle rewrites have
  // already been resolved above. Hand the request to next-intl so it
  // can detect the locale (from URL prefix, cookie, or Accept-Language),
  // set `NIMIMO_LOCALE`, and rewrite `/de/wallet` → `/[locale]/wallet`
  // with `locale=de`.
  //
  // We then re-issue the response so our CSP header, nonce, and
  // `x-pathname` come along - intl middleware doesn't know about those.
  const intlResponse = intlMiddleware(request)

  // Redirect branch (e.g. first-visit German user at `/` being 302'd
  // to `/de`): we can't meaningfully inject headers into a redirect,
  // so return it as-is. CSP will be set on the destination request
  // when it comes back around through this same middleware.
  if (intlResponse.status >= 300 && intlResponse.status < 400 && intlResponse.headers.get("location")) {
    return intlResponse
  }

  // Rewrite branch (the normal case for a locale-prefixed URL):
  // re-issue the rewrite with our modified request headers so the
  // downstream server components can still read `x-nonce`. If intl
  // didn't rewrite (e.g. URL is already `/` for the default locale),
  // fall back to `NextResponse.next()` with the same headers.
  const rewriteHeader = intlResponse.headers.get("x-middleware-rewrite")
  const response = rewriteHeader
    ? NextResponse.rewrite(new URL(rewriteHeader), {
        request: { headers: requestHeaders },
      })
    : NextResponse.next({ request: { headers: requestHeaders } })

  // Carry over the locale cookie and any other response headers
  // (notably `link`/`vary`/`set-cookie`) that next-intl produced.
  intlResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (
      lower === "set-cookie" ||
      lower === "link" ||
      lower === "vary" ||
      lower.startsWith("x-next-intl")
    ) {
      response.headers.append(key, value)
    }
  })

  response.headers.set("x-pathname", pathname)
  response.headers.set("Content-Security-Policy", cspHeader)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - raster / vector / icon assets served from /public (svg, png,
     *   jpg, jpeg, gif, webp, ico)
     * - JS / WASM / sourcemap assets served from /public (mjs, js,
     *   map, wasm) - notably the PDF.js worker at
     *   `/pdf.worker.min.mjs`, which the /recovery verify flow
     *   fetches dynamically to parse uploaded recovery PDFs. Without
     *   `mjs` in this list, the v1.2.0 next-intl middleware rewrites
     *   the worker URL to `/en/pdf.worker.min.mjs`, which 404s, PDF
     *   parsing crashes, and the user sees "Could not find QR code
     *   in the imported file". We also add `map` for the sourcemap
     *   sibling, and `js` / `wasm` defensively for any future
     *   client-side worker we might ship.
     * - `webmanifest` for the PWA manifest generated by
     *   `app/manifest.ts` at `/manifest.webmanifest`. Without this,
     *   next-intl rewrites the manifest URL to `/en/manifest.webmanifest`,
     *   which doesn't exist, and Next.js returns an HTML 404 page -
     *   Chrome then logs "Manifest: Line 1, column 1, Syntax error"
     *   because the response parses as HTML, not JSON, and "Add to
     *   Home Screen" silently breaks.
     * - `txt` and `xml` for the app-router text/XML convention routes:
     *   `/robots.txt` (app/robots.txt/route.ts), `/sitemap.xml`
     *   (app/sitemap.ts), `/llms.txt` (app/llms.txt/route.ts), and
     *   `/llms-full.txt` (app/llms-full.txt/route.ts). These all live
     *   at the app-router root, not under `[locale]`, so without the
     *   exclusion next-intl rewrites them to `/en/<file>` which has
     *   no matching route and falls through to the HTML 404 page.
     *   Crawlers then see a `text/html` body where they expected
     *   plain text or XML, which is catastrophic in two directions:
     *   (1) Googlebot/Bingbot silently lose the sitemap and stop
     *   discovering new architecture papers, and (2) ChatGPT Search,
     *   Perplexity, and other LLM crawlers can't resolve the curated
     *   corpus at `/llms.txt` + `/llms-full.txt` (the whole reason
     *   that corpus exists) so they fall back to scraping rendered
     *   HTML, which is exactly the scenario the corpus is meant to
     *   prevent. This was the v1.2.0 regression that `tasks/lessons.md`
     *   warned about explicitly - adding it here in v1.2.6 closes
     *   the last known gap.
     * - `opengraph-image` and `twitter-image` for the app-router
     *   file-based metadata convention routes at `app/opengraph-image.tsx`
     *   and `app/twitter-image.tsx`. Next.js serves these at
     *   `/opengraph-image` and `/twitter-image` (no file extension, so
     *   the extension-based exclusion above doesn't catch them). Meta
     *   tags in the rendered HTML point at these paths with a cache-busting
     *   query string (e.g. `/opengraph-image?abc123`), and every social
     *   scraper - X, Facebook, WhatsApp, LinkedIn, Discord, Telegram,
     *   iMessage, Slack - follows that exact URL. Without this exclusion,
     *   next-intl rewrites `/opengraph-image` → `/en/opengraph-image`,
     *   which doesn't exist (the file lives at the app-router root, not
     *   under `[locale]`), and every scraper gets the HTML 404 page
     *   instead of a PNG. Net effect: the landing link renders as a
     *   "blank card with no image" across every social surface, while
     *   the per-handle cards at `/<locale>/<handle>/opengraph-image`
     *   keep working because they sit under `[locale]` and route fine.
     *   The 404 prefix match also covers the hashed sub-paths Next.js
     *   may emit (e.g. `/opengraph-image/abc123`).
     *
     * None of these extensions can legitimately collide with an
     * app-router page route (page paths don't carry file extensions),
     * so excluding them is safe. See `tasks/lessons.md` for the
     * full incident writeup.
     */
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|js|map|wasm|webmanifest|txt|xml)$).*)",
  ],
}
