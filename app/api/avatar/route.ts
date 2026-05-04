import { NextRequest, NextResponse } from "next/server"
import { avatarQuerySchema, validate } from "@/lib/validation"

/**
 * Proxy for DiceBear Croodles avatar SVGs.
 * Avoids CSP img-src restrictions by serving external SVGs from our own origin.
 * Cached for 7 days (immutable - same seed always produces the same avatar).
 */
export async function GET(req: NextRequest) {
  const parsed = validate(avatarQuerySchema, {
    seed: req.nextUrl.searchParams.get("seed") ?? "",
    bg: req.nextUrl.searchParams.get("bg") || undefined,
  })
  if (parsed.error) return parsed.error
  const { seed, bg } = parsed.data

  const params = new URLSearchParams({
    seed,
    scale: "92",
    ...(bg ? { backgroundColor: bg } : {}),
  })

  const url = `https://api.dicebear.com/9.x/croodles-neutral/svg?${params}`

  try {
    const res = await fetch(url, { next: { revalidate: 604800 } }) // cache 7 days
    if (!res.ok) {
      return new NextResponse("Avatar service unavailable", { status: 502 })
    }

    const svg = await res.text()

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=604800, immutable",
      },
    })
  } catch {
    return new NextResponse("Avatar service unavailable", { status: 502 })
  }
}
