import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "nimimo - Receive crypto in seconds"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const DARK_BG = "#0d0d2b"
// Brand palette - mirrors the "default" palette in
// app/[locale]/[handle]/opengraph-image.tsx so the landing card and
// handle cards share a visual language.
const PALETTE = ["#3CF2D6", "#41c6e9", "#7B61FF"] as const

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default async function OGImage() {
  const [c1, c2, c3] = PALETTE
  const gradient = `linear-gradient(135deg, ${c1} 0%, ${c2} 45%, ${c3} 100%)`
  const bgGradient = `radial-gradient(circle at 18% 28%, ${hexToRgba(c1, 0.22)} 0%, transparent 55%), radial-gradient(circle at 82% 78%, ${hexToRgba(c3, 0.22)} 0%, transparent 55%), ${DARK_BG}`

  const logoData = await readFile(join(process.cwd(), "public", "logo.png"))
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`

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
                background: DARK_BG,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <img src={logoSrc} width={280} height={280} alt="" style={{ display: "flex" }} />
            </div>
          </div>

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
                fontSize: 112,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1,
                display: "flex",
                backgroundImage: gradient,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              nimimo
            </div>
            <div
              style={{
                fontSize: 40,
                color: "rgba(255,255,255,0.85)",
                marginTop: 28,
                lineHeight: 1.25,
                display: "flex",
              }}
            >
              Receive crypto in seconds.
            </div>
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

        <div
          style={{
            position: "absolute",
            bottom: 44,
            right: 56,
            fontSize: 28,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: -0.5,
            display: "flex",
          }}
        >
          nimimo.com
        </div>
      </div>
    ),
    { ...size },
  )
}
