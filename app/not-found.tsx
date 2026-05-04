import Link from "next/link"

// Root-level 404 - only reached when the request never makes it into
// a locale segment (e.g. a non-page URL like `/__foo__` that the proxy
// lets through). Every in-app 404 should route through the localized
// `app/[locale]/not-found.tsx` instead.
//
// We can't use `<AppHeader>` or any of the providers here because this
// renders OUTSIDE `app/[locale]/layout.tsx` - the root layout is just
// a pass-through. So this page ships its own minimal `<html>` shell.
export default function GlobalNotFound() {
  return (
    <html lang="en" translate="no" className="dark">
      <body className="bg-[#0d0d2b] text-white font-sans antialiased">
        <main className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-semibold">Page not found</h1>
            <p className="text-white/60">
              The page you&rsquo;re looking for doesn&rsquo;t exist or has been removed.
            </p>
            <Link
              href="/"
              className="inline-block mt-2 rounded-full bg-white text-[#0d0d2b] px-6 py-2 text-sm font-semibold"
            >
              Go to homepage
            </Link>
          </div>
        </main>
      </body>
    </html>
  )
}
