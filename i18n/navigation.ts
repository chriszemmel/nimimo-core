import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

// Locale-aware wrappers around Next.js navigation primitives.
//
// Use these instead of `next/link`, `next/navigation`'s `useRouter`,
// etc. when the destination is a *localized* route - they automatically
// prepend the current locale prefix (`/de/wallet` vs `/wallet`) without
// the call site having to know which locale is active.
//
// For non-localized destinations (API routes, `@handle` shortcuts,
// external URLs, the OpenGraph image endpoint, etc.) keep using the
// plain `next/link` + `next/navigation` imports - prefixing those would
// produce 404s.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
