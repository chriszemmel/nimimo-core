"use client"

import { useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"

interface BrandedQRCodeProps {
  data: string
  /**
   * Native asset ticker for the chain - used to look up the QR center
   * logo and the default "Receive {Chain}" tagline. Unknown symbols
   * fall back to no logo + no tagline.
   */
  chainSymbol: string
  /**
   * Optional override for the QR center logo. Falls back to `LOGO_MAP[chainSymbol]`.
   * Useful when the same symbol is shared across chains (e.g. Base uses ETH)
   * but we want a different brand logo.
   */
  logoUrl?: string
  displaySize?: number
  /**
   * Subtitle rendered below the "nimimo.com" wordmark. Defaults to
   * "Receive {Chain}" for the receive flows. Pass `null` to hide the
   * subtitle entirely (used by payment flows like the handle upgrade
   * wizard, where "Receive Ethereum" would be misleading).
   */
  tagline?: string | null
}

const LOGO_MAP: Record<string, string> = {
  BTC: "/logos/bitcoin.svg",
  ETH: "/logos/ethereum.svg",
  SOL: "/logos/solana.svg",
}

const TAGLINES: Record<string, string> = {
  BTC: "Receive Bitcoin",
  ETH: "Receive Ethereum",
  SOL: "Receive Solana",
}

export function BrandedQRCode({ data, chainSymbol, logoUrl, displaySize = 350, tagline }: BrandedQRCodeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!ref.current) return

    setIsLoading(true)

    async function loadAndRender() {
    const { default: QRCodeStyling } = await import("qr-code-styling")
    const qrCode = new QRCodeStyling({
      width: 800,
      height: 800,
      data: data,
      margin: 20,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "H",
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.25,
        margin: 10,
      },
      dotsOptions: {
        type: "rounded",
        color: "#000000",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      image: logoUrl ?? LOGO_MAP[chainSymbol],
      cornersSquareOptions: {
        type: "extra-rounded",
        color: "#000000",
      },
      cornersDotOptions: {
        type: "dot",
        color: "#000000",
      },
    })

    // Generate QR code and composite with text on 1000x1000 canvas
    qrCode.getRawData("png").then((blob) => {
      if (!blob) return

      const img = new Image()
      img.onload = () => {
        // Create final 1000x1000 canvas
        const finalCanvas = document.createElement("canvas")
        finalCanvas.width = 1000
        finalCanvas.height = 1000
        const ctx = finalCanvas.getContext("2d")
        if (!ctx) return

        // White background
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, 1000, 1000)

        // Draw QR code centered horizontally, top-aligned with space for text
        const qrX = 100 // Center: (1000 - 800) / 2
        const qrY = 60 // Leave space at top
        ctx.drawImage(img, qrX, qrY, 800, 800)

        // Draw text below QR code
        const textY = qrY + 800 + 50 // 50px below QR

        // "nimimo.com" text
        ctx.font = "600 32px system-ui, -apple-system, sans-serif"
        ctx.fillStyle = "#aaaaaa"
        ctx.textAlign = "center"
        ctx.fillText("nimimo.com", 500, textY)

        // Tagline (optional) - `tagline === null` hides it entirely,
        // `undefined` falls back to the default "Receive {Chain}" copy.
        const resolvedTagline =
          tagline === null ? null : tagline ?? TAGLINES[chainSymbol]
        if (resolvedTagline) {
          ctx.font = "500 28px system-ui, -apple-system, sans-serif"
          ctx.fillStyle = "#999999"
          ctx.fillText(resolvedTagline, 500, textY + 40)
        }

        // Replace old canvas
        if (canvasRef.current) {
          canvasRef.current.remove()
        }
        canvasRef.current = finalCanvas

        // Style for display
        finalCanvas.style.width = `${displaySize}px`
        finalCanvas.style.height = `${displaySize}px`
        finalCanvas.style.objectFit = "contain"

        ref.current!.innerHTML = ""
        ref.current!.appendChild(finalCanvas)

        setIsLoading(false)
      }
      img.src = URL.createObjectURL(blob as Blob)
    })
    }
    loadAndRender()
  }, [data, chainSymbol, logoUrl, displaySize, tagline])

  return (
    <div className="flex items-center justify-center w-full relative" style={{ minHeight: `${displaySize}px` }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div
        ref={ref}
        className={`flex items-center justify-center w-full ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
      />
    </div>
  )
}
