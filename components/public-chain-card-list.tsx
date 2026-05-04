"use client"

import { useState } from "react"
import { PublicChainCard } from "@/components/public-chain-card"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"

interface PublicChainCardListProps {
  addresses: DerivedAddress[]
}

export function PublicChainCardList({ addresses }: PublicChainCardListProps) {
  const [expandedChain, setExpandedChain] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {addresses.map((address) => (
        <PublicChainCard
          key={address.chain}
          address={address}
          isExpanded={expandedChain === address.chain}
          onToggle={() => setExpandedChain(expandedChain === address.chain ? null : address.chain)}
        />
      ))}
    </div>
  )
}
