import type React from "react"
import "./globals.css"

// NOTE: This is the ROOT layout. With next-intl app-router routing,
// the real `<html>` + `<body>` shell lives in `app/[locale]/layout.tsx`
// where the locale param is available to drive `<html lang>`.
//
// This file stays as a minimal pass-through because Next.js still
// requires a root layout to exist (and because static asset routes
// like `/llms.txt`, `/sitemap.xml`, `/manifest.webmanifest`, and the
// root `opengraph-image.tsx` render outside the `[locale]` segment and
// need *something* to resolve up to). We can't put `<html>` here
// because we don't know the locale at this level.
//
// See next-intl v4 docs: "Setup - App Router / With i18n routing".
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
