"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { useOwnership } from "@/components/ownership-provider"
import { useBalances } from "@/app/[locale]/wallet/hooks/use-balances"
import { SendFlow } from "@/components/send-flow"
import type { ChainType } from "@/components/send-flow/types"

interface ProfileSendCtaProps {
  handle: string
  addresses: { chain: string; address: string }[]
}

const CHAINS: { chain: ChainType; symbol: string; name: string; logo: string }[] = [
  { chain: "bitcoin", symbol: "BTC", name: "Bitcoin", logo: "/logos/bitcoin.svg" },
  { chain: "ethereum", symbol: "ETH", name: "Ethereum", logo: "/logos/ethereum.svg" },
  { chain: "solana", symbol: "SOL", name: "Solana", logo: "/logos/solana.svg" },
]

export function ProfileSendCta({ handle, addresses }: ProfileSendCtaProps) {
  const { data: session } = useSession()
  const { ownershipId } = useOwnership()
  const { balances } = useBalances(ownershipId)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendChain, setSendChain] = useState<ChainType | undefined>()

  const isLoggedIn = !!session?.user

  const openSend = (chain: ChainType) => {
    setSendChain(chain)
    setSendOpen(true)
  }

  // Only show chains the profile has addresses for
  const availableChains = CHAINS.filter((c) =>
    addresses.some((a) => a.chain === c.chain)
  )

  const sendableBalances = balances.map((b) => ({
    chain: b.chain,
    token: b.token,
    symbol: b.symbol,
    name: b.name,
    logo: b.logo,
    address: b.address,
    balance: b.balance,
    balanceFiatEUR: b.balanceFiatEUR,
    balanceFiatUSD: b.balanceFiatUSD,
    priceEUR: b.priceEUR,
    priceUSD: b.priceUSD,
  }))

  return (
    <>
      <div className="rounded-2xl border border-border/50 bg-card/30 px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-brand-gradient">
            Send to @{handle}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {availableChains.map(({ chain, symbol, logo }) => {
            const bal = balances.find((b) => b.chain === chain)
            const hasBalance = bal && parseFloat(bal.balance) > 0

            if (!isLoggedIn) {
              return (
                <Link
                  key={chain}
                  href="/auth/login"
                  className="flex flex-col items-center gap-1 rounded-xl border border-border/40 bg-secondary/30 px-2 py-2 text-center opacity-60 hover:opacity-80 transition-opacity"
                >
                  <Image src={logo} alt={symbol} width={20} height={20} className="w-5 h-5" />
                  <span className="text-[10px] text-muted-foreground">Sign in</span>
                </Link>
              )
            }

            return (
              <button
                key={chain}
                onClick={() => hasBalance && openSend(chain)}
                disabled={!hasBalance}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition-all ${
                  hasBalance
                    ? "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 cursor-pointer"
                    : "border-border/30 bg-secondary/20 opacity-40 cursor-not-allowed"
                }`}
              >
                <Image src={logo} alt={symbol} width={20} height={20} className="w-5 h-5" />
                <span className="text-[11px] font-medium text-foreground">{symbol}</span>
                <span className="text-[9px] text-muted-foreground leading-none">
                  {hasBalance
                    ? `${parseFloat(bal.balance).toFixed(bal.chain === "bitcoin" ? 6 : 4)}`
                    : "No balance"
                  }
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoggedIn && ownershipId && (
        <SendFlow
          open={sendOpen}
          onOpenChange={setSendOpen}
          ownershipId={ownershipId}
          balances={sendableBalances}
          prefillHandle={handle}
          prefillChain={sendChain}
        />
      )}
    </>
  )
}
