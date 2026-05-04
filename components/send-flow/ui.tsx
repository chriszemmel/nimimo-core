"use client"

// Shared UI sub-components for the send flow.

import Image from "next/image"
import { ArrowLeft, X, Check } from "lucide-react"
import { useTranslations } from "next-intl"
import { CroodlesAvatar } from "@/components/croodles-avatar"
import { HandleImage } from "@/components/handle-image"
import type { RecipientResult } from "./types"
import { truncateAddress } from "./chain-utils"

// ── Address identicon ─────────────────────────────────────────────────────────

export function AddressIdenticon({ address, size = 40 }: { address: string; size?: number }) {
  const hue = address.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="rounded-full flex items-center justify-center font-mono text-xs font-bold text-white shrink-0"
      style={{ width: size, height: size, background: `hsl(${hue},52%,42%)` }}
    >
      {address.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Recipient avatar ──────────────────────────────────────────────────────────

export function RecipientAvatar({ recipient, size = 40 }: { recipient: RecipientResult; size?: number }) {
  // Use real avatar if available. Routed through HandleImage so the
  // browser paints cached pixels on the same frame as the new DOM
  // element - next/image's own mount lifecycle introduces a one-frame
  // gap that surfaces as a visible flash every time we cross a
  // step-key boundary in the send flow.
  if (recipient.avatarUrl) {
    return (
      <HandleImage
        src={recipient.avatarUrl}
        alt={recipient.handle ?? recipient.nimimoHandle ?? ""}
        size={size}
      />
    )
  }
  const handleForAvatar = recipient.type === "handle" ? recipient.handle : recipient.nimimoHandle
  if (handleForAvatar) {
    return <CroodlesAvatar handle={handleForAvatar} size={size} />
  }
  const addr = recipient.addresses[0]?.address ?? recipient.input
  return <AddressIdenticon address={addr} size={size} />
}

// ── Asset logo ────────────────────────────────────────────────────────────────

const CHAIN_LOGO: Record<string, string> = {
  bitcoin: "/logos/bitcoin.svg",
  ethereum: "/logos/ethereum.svg",
  solana: "/logos/solana.svg",
}

const TOKEN_LOGO: Record<string, string> = {
  USDC: "/logos/usdc.svg",
}

export function ChainLogo({ chain, token, size = 28 }: { chain: string; token?: string; size?: number }) {
  const logo = (token && TOKEN_LOGO[token]) ?? CHAIN_LOGO[chain]
  const alt = token ?? chain
  if (logo) {
    return (
      <div
        className="rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <Image src={logo} alt={alt} width={size} height={size} className="w-full h-full" />
      </div>
    )
  }
  // Fallback for unknown assets
  return (
    <div
      className="rounded-full bg-secondary text-muted-foreground flex items-center justify-center font-bold shrink-0 text-xs"
      style={{ width: size, height: size }}
    >
      ?
    </div>
  )
}

// ── Step header ───────────────────────────────────────────────────────────────

export function StepHeader({
  title,
  stepNumber,
  totalSteps,
  onBack,
  onClose,
}: {
  title: string
  stepNumber: number
  totalSteps: number
  onBack?: () => void
  onClose: () => void
}) {
  const t = useTranslations("sendFlow")
  const tCommon = useTranslations("common")
  return (
    <div className="flex items-center px-4 h-[72px] shrink-0 border-b border-border/50 relative">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-secondary">
        <div
          className="h-full bg-foreground/60 transition-all duration-300 ease-out"
          style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
        />
      </div>

      {/* Back button */}
      <div className="w-10 flex items-center">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-secondary transition-colors"
            aria-label={tCommon("back")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 text-center pt-1">
        <p className="font-semibold text-[17px] leading-none">{title}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {t("stepOf", { current: stepNumber, total: totalSteps })}
        </p>
      </div>

      {/* Close button */}
      <div className="w-10 flex items-center justify-end">
        <button
          onClick={onClose}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          aria-label={t("close")}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// ── Recipient card ────────────────────────────────────────────────────────────

export function RecipientCard({
  recipient,
  selectedChain,
}: {
  recipient: RecipientResult
  selectedChain?: string | null
}) {
  const t = useTranslations("sendFlow")
  // For handle recipients, only show chain info once user has selected one
  const isHandle = recipient.type === "handle"
  const resolvedChain = selectedChain ?? (isHandle ? null : recipient.chain)
  const displayAddr = resolvedChain
    ? recipient.addresses.find((a) => a.chain === resolvedChain)?.address
    : null
  const chainLabel = resolvedChain
    ? resolvedChain.charAt(0).toUpperCase() + resolvedChain.slice(1)
    : null

  return (
    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
      <RecipientAvatar recipient={recipient} size={40} />
      <div className="min-w-0 flex-1">
        {isHandle ? (
          <>
            <p className="font-medium text-sm">@{recipient.handle}</p>
            {displayAddr ? (
              <p className="font-mono text-xs text-muted-foreground truncate">
                {truncateAddress(displayAddr)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("selectAssetHint")}</p>
            )}
          </>
        ) : (
          <>
            {recipient.nimimoHandle ? (
              <p className="font-medium text-sm">@{recipient.nimimoHandle}</p>
            ) : null}
            <p className={`font-mono text-xs ${recipient.nimimoHandle ? "text-muted-foreground" : "text-sm text-foreground"}`}>
              {truncateAddress(recipient.input)}
            </p>
            {chainLabel && !recipient.nimimoHandle && (
              <p className="text-xs text-muted-foreground">{chainLabel}</p>
            )}
          </>
        )}
      </div>
      {chainLabel && (
        <span className="text-xs bg-background border border-border rounded-full px-2.5 py-0.5 shrink-0 font-medium">
          {chainLabel}
        </span>
      )}
    </div>
  )
}

// ── Asset selector (handle or Solana-address recipient) ──────────────────────
//
// Matches the four assets on the wallet page (BTC, ETH, SOL, USDC) so the
// wallet and send flow share one mental model. Addresses are still
// chain-scoped (Solana's wallet address receives both SOL and USDC), so a
// recipient with a Solana address exposes two asset options.

export interface AssetOption {
  chain: string
  /** Undefined for the chain's native asset. "USDC" for the Solana SPL token. */
  token?: string
  /** Short symbol: BTC, ETH, SOL, USDC. */
  symbol: string
  /** Human-readable label: Bitcoin, Ethereum, Solana, USDC. */
  name: string
  /** The wallet-level address that receives this asset. Shared across the
   *  chain's assets (Solana's SOL + USDC land on the same address). */
  address: string
}

const ASSET_NAME: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  USDC: "USDC",
}

export function assetsFromAddresses(addresses: { chain: string; address: string }[]): AssetOption[] {
  const byChain = new Map<string, string>()
  for (const { chain, address } of addresses) byChain.set(chain, address)

  const options: AssetOption[] = []
  const btc = byChain.get("bitcoin")
  if (btc) options.push({ chain: "bitcoin", symbol: "BTC", name: ASSET_NAME.BTC, address: btc })
  const eth = byChain.get("ethereum")
  if (eth) options.push({ chain: "ethereum", symbol: "ETH", name: ASSET_NAME.ETH, address: eth })
  const sol = byChain.get("solana")
  if (sol) {
    options.push({ chain: "solana", symbol: "SOL", name: ASSET_NAME.SOL, address: sol })
    options.push({ chain: "solana", token: "USDC", symbol: "USDC", name: ASSET_NAME.USDC, address: sol })
  }
  return options
}

export function AssetSelector({
  options,
  selectedChain,
  selectedToken,
  onSelect,
}: {
  options: AssetOption[]
  selectedChain: string | null
  selectedToken: string | undefined
  onSelect: (asset: AssetOption) => void
}) {
  const t = useTranslations("sendFlow")
  if (options.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t("selectAssetTitle")}
      </p>
      <div className="space-y-1.5">
        {options.map((opt) => {
          const isSelected = selectedChain === opt.chain && (selectedToken ?? undefined) === (opt.token ?? undefined)
          const key = `${opt.chain}:${opt.token ?? "native"}`
          return (
            <button
              key={key}
              onClick={() => onSelect(opt)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors text-left ${
                isSelected
                  ? "border-foreground bg-secondary"
                  : "border-border hover:bg-secondary/50"
              }`}
            >
              <ChainLogo chain={opt.chain} token={opt.token} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{opt.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{truncateAddress(opt.address)}</p>
              </div>
              {isSelected && <Check className="w-4 h-4 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
