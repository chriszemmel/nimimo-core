"use client"

import { useState, useEffect, useCallback } from "react"
import { Copy, Check, X, Download, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"
import { BrandedQRCode } from "@/components/branded-qr-code"

const LOGO_MAP: Record<string, string> = {
  BTC: "/logos/bitcoin.svg",
  ETH: "/logos/ethereum.svg",
  SOL: "/logos/solana.svg",
}

/**
 * Build a wallet deep-link URI so tapping "Open in wallet" on mobile
 * launches the sender's native wallet app with the recipient address
 * pre-filled.
 */
function buildWalletURI(symbol: string, address: string): string | null {
  switch (symbol) {
    case "BTC":
      return `bitcoin:${address}`
    case "ETH":
      return `ethereum:${address}@1`
    case "SOL":
      return `solana:${address}`
    default:
      return null
  }
}

interface AddressBottomSheetProps {
  address: DerivedAddress | null
  open: boolean
  onClose: () => void
}

export function AddressBottomSheet({ address, open, onClose }: AddressBottomSheetProps) {
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      setExpanded(false)
      onClose()
    }, 200)
  }, [onClose])

  useEffect(() => {
    setCopied(false)
    setExpanded(false)
  }, [address?.chain])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, handleClose])

  if (!open || !address) return null

  const activeAddress = address.address
  const activeSymbol = address.symbol

  const logoSrc = LOGO_MAP[address.symbol] || "/placeholder.svg"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const canvas = document.querySelector("#bottom-sheet-qr canvas") as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = `nimimo-${activeSymbol.toLowerCase()}-qr.png`
      link.href = url
      link.click()
    }
  }

  const truncated = `${activeAddress.slice(0, 8)}...${activeAddress.slice(-6)}`
  const walletURI = buildWalletURI(activeSymbol, activeAddress)

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bottom-sheet-backdrop ${
        closing ? "bg-black/0" : "bg-black/40"
      } transition-colors duration-200`}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-lg bottom-sheet-surface backdrop-blur-xl rounded-t-[20px] border border-border/60 border-b-0 p-6 pb-8 ${
          closing ? "bottom-sheet-exit" : "bottom-sheet-enter"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center bottom-sheet-header-accent">
              <Image
                src={logoSrc}
                alt={address.name}
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <div>
              <p className="font-semibold text-foreground">{address.name}</p>
              <p className="text-xs text-muted-foreground">Receiving address</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Address */}
        <div
          className="font-mono text-sm text-foreground bg-background/60 border border-border/40 rounded-xl px-4 py-3 mb-4 cursor-pointer hover:bg-background/80 transition-colors text-center break-all"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? activeAddress : truncated}
        </div>

        {/* QR Code - always visible. Receiving an address is the modal's
            primary purpose, so we skip the extra "Show QR" tap. */}
        <div className="mb-4">
          <div
            className="bg-white rounded-xl overflow-hidden flex items-center justify-center"
            id="bottom-sheet-qr"
          >
            <BrandedQRCode
              data={activeAddress}
              chainSymbol={activeSymbol}
              displaySize={240}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              onClick={handleCopy}
              className="flex-1 gap-2 h-11 rounded-xl"
            >
              {copied ? (
                <><Check className="w-4 h-4" /> Copied</>
              ) : (
                <><Copy className="w-4 h-4" /> Copy</>
              )}
            </Button>
            <Button
              onClick={handleDownload}
              className="flex-1 gap-2 h-11 rounded-xl"
            >
              <Download className="w-4 h-4" /> Save QR
            </Button>
          </div>
          {walletURI && (
            <a
              href={walletURI}
              className="flex items-center justify-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <Wallet className="w-3.5 h-3.5" /> Open in external wallet
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
