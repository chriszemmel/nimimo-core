"use client"

import type React from "react"
import { useState } from "react"
import { ChevronDown, Copy, QrCode, Check, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"
import { BrandedQRCode } from "@/components/branded-qr-code"

const LOGO_MAP: Record<string, string> = {
  BTC: "/logos/bitcoin.svg",
  ETH: "/logos/ethereum.svg",
  SOL: "/logos/solana.svg",
}

interface PublicChainCardProps {
  address: DerivedAddress
  isExpanded: boolean
  onToggle: () => void
}

export function PublicChainCard({ address, isExpanded, onToggle }: PublicChainCardProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const logoSrc = LOGO_MAP[address.symbol] || "/placeholder.svg"

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(address.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleQR = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowQR(true)
  }

  const handleDownload = () => {
    const canvas = document.querySelector("#branded-qr-container canvas") as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = `nimimo-${address.symbol.toLowerCase()}-qr.png`
      link.href = url
      link.click()
    }
  }

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <button
          onClick={onToggle}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              <Image
                src={logoSrc}
                alt={address.name}
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">{address.name}</p>
              <p className="text-sm text-muted-foreground">{address.symbol}</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/30">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Receiving address</p>
                <p className="font-mono text-sm text-foreground break-all bg-background p-3 rounded border border-border">
                  {address.address}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1 gap-2 bg-transparent">
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleQR} className="flex-1 gap-2 bg-transparent">
                  <QrCode className="w-4 h-4" />
                  QR Code
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showQR && (
        <div
          className="fixed inset-0 h-[100dvh] bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQR(false)}
        >
          <div className="bg-card rounded-xl p-6 max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <Image
                src={logoSrc}
                alt={address.name}
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <div>
                <p className="font-medium text-foreground">{address.name}</p>
                <p className="text-sm text-muted-foreground">{address.symbol}</p>
              </div>
            </div>

            <div
              className="bg-white rounded-lg mb-4 flex items-center justify-center overflow-hidden"
              id="branded-qr-container"
            >
              <BrandedQRCode
                data={address.address}
                chainSymbol={address.symbol}
                displaySize={320}
              />
            </div>

            <p className="font-mono text-xs text-muted-foreground break-all text-center mb-4">{address.address}</p>

            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2 bg-transparent">
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button onClick={() => setShowQR(false)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
