import { ImageResponse } from "next/og"
import { neon } from "@neondatabase/serverless"

export const alt = "nimimo profile"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const runtime = "edge"

const DARK_BG = "#0d0d2b"

// Mirrors the palette table in components/profile/templates/index.ts.
// Kept in sync manually - if you add a palette there, add it here too.
const PALETTES: Record<string, [string, string, string]> = {
  default: ["#3CF2D6", "#41c6e9", "#7B61FF"],
  ember: ["#FF8C42", "#FF6B6B", "#E040FB"],
  green: ["#4ADE80", "#22C55E", "#15803D"],
  gold: ["#FFD700", "#F5A623", "#D4860B"],
  purple: ["#A855F7", "#8B5CF6", "#6D28D9"],
  rose: ["#FB7185", "#F43F5E", "#BE123C"],
  ice: ["#7DD3FC", "#38BDF8", "#0284C7"],
  sunset: ["#FBBF24", "#F97316", "#DC2626"],
  midnight: ["#818CF8", "#6366F1", "#4338CA"],
}

// Mirrors lib/croodles/generator.ts - deterministic soft-tone backgrounds.
const CROODLES_BGS = ["e0f2fe", "f1f5f9", "e2e8f0", "eef2ff", "dbeafe"]

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h)
}

function croodlesBgFor(handle: string): string {
  return CROODLES_BGS[hashString(handle || "anonymous") % CROODLES_BGS.length]
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function toBase64(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  )
}

async function fetchAsDataURI(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ct = res.headers.get("content-type") || "image/png"
    const buf = new Uint8Array(await res.arrayBuffer())
    return `data:${ct};base64,${toBase64(buf)}`
  } catch {
    return null
  }
}

type ProfileData = {
  displayHandle: string
  bio: string | null
  avatarUrl: string | null
  palette: string
}

async function loadProfile(handle: string): Promise<ProfileData | null> {
  if (!process.env.DATABASE_URL) return null
  try {
    const sql = neon(process.env.DATABASE_URL)
    const registry = await sql`
      SELECT hr.ownership_id FROM handle_registry hr
      JOIN identities i ON i.ownership_id = hr.ownership_id AND i.status = 'active'
      WHERE hr.handle = ${handle} LIMIT 1
    `
    let ownershipId: string | null = null
    if (registry.length > 0) {
      ownershipId = registry[0].ownership_id as string
    } else {
      const direct = await sql`
        SELECT ownership_id FROM identities WHERE handle = ${handle} AND status = 'active' LIMIT 1
      `
      if (direct.length > 0) ownershipId = direct[0].ownership_id as string
    }
    if (!ownershipId) return null

    const rows = await sql`
      SELECT i.bio, i.avatar_url, i.profile_palette
      FROM identities i
      WHERE i.ownership_id = ${ownershipId} AND i.status = 'active' LIMIT 1
    `
    if (rows.length === 0) return null

    const primary = await sql`
      SELECT handle FROM handle_registry
      WHERE ownership_id = ${ownershipId} AND type = 'primary' LIMIT 1
    `
    const displayHandle = primary.length > 0 ? (primary[0].handle as string) : handle

    return {
      displayHandle,
      bio: (rows[0].bio as string | null) ?? null,
      avatarUrl: (rows[0].avatar_url as string | null) ?? null,
      palette: (rows[0].profile_palette as string | null) ?? "default",
    }
  } catch {
    return null
  }
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const base = getBaseUrl()

  const [profile, logoSrc] = await Promise.all([
    loadProfile(handle),
    fetchAsDataURI(`${base}/apple-icon.png`),
  ])

  const displayHandle = profile?.displayHandle ?? handle
  const bio = profile?.bio?.trim() || null
  const paletteId = profile?.palette ?? "default"
  const palette = PALETTES[paletteId] ?? PALETTES.default
  const [c1, c2, c3] = palette
  const gradient = `linear-gradient(135deg, ${c1} 0%, ${c2} 45%, ${c3} 100%)`
  const bgGradient = `radial-gradient(circle at 18% 28%, ${hexToRgba(c1, 0.22)} 0%, transparent 55%), radial-gradient(circle at 82% 78%, ${hexToRgba(c3, 0.22)} 0%, transparent 55%), ${DARK_BG}`

  let avatarSrc: string | null = null
  if (profile?.avatarUrl) {
    avatarSrc = await fetchAsDataURI(profile.avatarUrl)
  }
  if (!avatarSrc) {
    const bg = croodlesBgFor(displayHandle)
    avatarSrc = await fetchAsDataURI(
      `${base}/api/avatar?seed=${encodeURIComponent(displayHandle.toLowerCase())}&bg=${bg}`,
    )
  }

  const initial = (displayHandle[0] || "n").toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: bgGradient,
          padding: "72px 80px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 60,
            width: "100%",
          }}
        >
          {/* Avatar with gradient ring */}
          <div
            style={{
              width: 352,
              height: 352,
              borderRadius: 176,
              background: gradient,
              padding: 8,
              display: "flex",
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 336,
                height: 336,
                borderRadius: 168,
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  width={336}
                  height={336}
                  alt=""
                  style={{
                    width: 336,
                    height: 336,
                    borderRadius: 168,
                    objectFit: "cover",
                    display: "flex",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 336,
                    height: 336,
                    borderRadius: 168,
                    background: gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 176,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {initial}
                </div>
              )}
            </div>
          </div>

          {/* Handle + bio */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                // Scale down the @handle as it gets longer so it always
                // renders on a single line. The avatar takes 352px on the
                // left plus a 60px gap, leaving ~628px for text inside a
                // 1200×630 canvas with 80px side padding - at fontSize 92
                // anything over ~10 chars overflows and CSS would break
                // on the hyphen (e.g. `@equal-penguin` split into
                // `@equal-` / `penguin`). Keep the top band at 92 so
                // short handles (like `@chris`) render exactly as they
                // did before; only shrink the longer ones. The
                // `whiteSpace: nowrap` is a belt-and-suspenders safety
                // net in case a future handle length policy pushes past
                // these bands.
                fontSize:
                  `@${displayHandle}`.length <= 11
                    ? 92
                    : `@${displayHandle}`.length <= 14
                      ? 76
                      : `@${displayHandle}`.length <= 18
                        ? 62
                        : 50,
                fontWeight: 800,
                letterSpacing: -2.5,
                lineHeight: 1,
                display: "flex",
                whiteSpace: "nowrap",
                backgroundImage: gradient,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              @{displayHandle}
            </div>
            {bio ? (
              <div
                style={{
                  fontSize: 36,
                  color: "rgba(255,255,255,0.78)",
                  marginTop: 28,
                  lineHeight: 1.28,
                  display: "flex",
                }}
              >
                {bio}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 32,
                  color: "rgba(255,255,255,0.55)",
                  marginTop: 24,
                  display: "flex",
                }}
              >
                Send crypto to a name, not an address.
              </div>
            )}
            <div
              style={{
                width: 168,
                height: 6,
                background: gradient,
                borderRadius: 3,
                marginTop: 36,
                display: "flex",
              }}
            />
          </div>
        </div>

        {/* nimimo wordmark - bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: 44,
            right: 56,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {logoSrc ? (
            <img
              src={logoSrc}
              width={40}
              height={40}
              alt=""
              style={{ display: "flex", borderRadius: 8 }}
            />
          ) : null}
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: -0.5,
              display: "flex",
            }}
          >
            nimimo
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
