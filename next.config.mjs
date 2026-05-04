// Suppress url.parse() deprecation warning (DEP0169) from next-auth v4 internals
process.env.NODE_OPTIONS ??= ''
if (!process.env.NODE_OPTIONS.includes('--disable-warning=DEP0169')) {
  process.env.NODE_OPTIONS += ' --disable-warning=DEP0169'
}

import createNextIntlPlugin from 'next-intl/plugin'

// Point the plugin at our request-level locale resolver so `await
// getRequestConfig(...)` is wired up at build time. Without this, every
// server component call to `getTranslations()` would fall back to the
// default locale.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude canvas from client-side bundles (pdfjs-dist doesn't need it in browser)
    if (!isServer) {
      config.resolve.alias.canvas = false
    }

    // Handle pdfjs-dist worker
    config.resolve.alias['pdfjs-dist'] = 'pdfjs-dist/legacy/build/pdf.mjs'

    return config
  },
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // CSP is set dynamically per-request in proxy.ts with a nonce
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
