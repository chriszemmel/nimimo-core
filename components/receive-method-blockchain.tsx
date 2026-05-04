"use client"

import type React from "react"

import { useState } from "react"
import { ChevronDown, Copy, QrCode, Check, Download } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { BrandedQRCode } from "@/components/branded-qr-code"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"

interface ReceiveMethodBlockchainProps {
  address: DerivedAddress
  isExpanded?: boolean
  onToggle?: () => void
}

export function ReceiveMethodBlockchain({ address, isExpanded = false, onToggle }: ReceiveMethodBlockchainProps) {
  const t = useTranslations("identity.receiveBlockchain")
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const activeAddress = address.address
  const activeSymbol = address.symbol

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(activeAddress)
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
      link.download = `nimimo-${activeSymbol.toLowerCase()}-qr.png`
      link.href = url
      link.click()
    }
  }

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <button
          onClick={onToggle}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              <Image
                src={address.logo || "/placeholder.svg"}
                alt={address.name}
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground text-sm">{address.name}</p>
              {address.chain === "solana" && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("solanaAcceptsUsdc")}
                </p>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && (
          <div className="px-4 pb-3 pt-2 border-t border-border bg-secondary/30 space-y-3">
            <p className="font-mono text-xs text-foreground break-all bg-background p-2 rounded border border-border">
              {activeAddress}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                className="flex-1 px-3 py-1.5 text-xs border border-border rounded hover:bg-secondary transition-colors flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {t("copied")}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    {t("copy")}
                  </>
                )}
              </button>
              <button
                onClick={handleQR}
                className="flex-1 px-3 py-1.5 text-xs border border-border rounded hover:bg-secondary transition-colors flex items-center justify-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                {t("qr")}
              </button>
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
                src={address.logo || "/placeholder.svg"}
                alt={address.name}
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <p className="font-medium text-foreground">{address.name}</p>
            </div>

            <div
              className="bg-white rounded-lg mb-4 flex items-center justify-center overflow-hidden"
              id="branded-qr-container"
            >
              <BrandedQRCode
                data={activeAddress}
                chainSymbol={activeSymbol}
                displaySize={320}
              />
            </div>

            <p className="font-mono text-xs text-muted-foreground break-all text-center mb-4">{activeAddress}</p>

            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2 bg-transparent">
                <Download className="w-4 h-4" />
                {t("download")}
              </Button>
              <Button onClick={() => setShowQR(false)} className="flex-1">
                {t("close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
