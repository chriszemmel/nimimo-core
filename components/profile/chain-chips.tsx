"use client"

import { useState } from "react"
import Image from "next/image"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"

const LOGO_MAP: Record<string, string> = {
  BTC: "/logos/bitcoin.svg",
  ETH: "/logos/ethereum.svg",
  SOL: "/logos/solana.svg",
}

interface ChainChipsProps {
  addresses: DerivedAddress[]
  onChipTap: (address: DerivedAddress) => void
}

export function ChainChips({ addresses, onChipTap }: ChainChipsProps) {
  const [activeChain, setActiveChain] = useState<string | null>(null)
  const [rippleChain, setRippleChain] = useState<string | null>(null)

  const handleTap = (address: DerivedAddress) => {
    setActiveChain(address.chain === activeChain ? null : address.chain)
    setRippleChain(address.chain)
    setTimeout(() => setRippleChain(null), 400)
    onChipTap(address)
  }

  return (
    <div className="flex items-center justify-center gap-2.5">
      {addresses.map((addr) => (
        <button
          key={addr.chain}
          onClick={() => handleTap(addr)}
          className={`relative overflow-hidden flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-all cursor-pointer ${
            activeChain === addr.chain ? "chip-active" : "chip-default"
          } ${rippleChain === addr.chain ? "chip-ripple" : ""}`}
        >
          <Image
            src={LOGO_MAP[addr.symbol] || addr.logo || "/placeholder.svg"}
            alt={addr.symbol}
            width={16}
            height={16}
            className="w-4 h-4"
          />
          <span className="text-foreground">{addr.symbol}</span>
        </button>
      ))}
    </div>
  )
}
