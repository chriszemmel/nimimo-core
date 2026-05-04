"use client"

import { useState } from "react"
import { Pencil, Loader2, Calendar } from "lucide-react"
import { AvatarGlow } from "@/components/profile/avatar-glow"
import { HeroCta } from "@/components/profile/hero-cta"
import { AddressBottomSheet } from "@/components/profile/address-bottom-sheet"
import Image from "next/image"
import { BadgeRow } from "@/components/profile/badge-pill"
import type { TemplateProps } from "./types"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"

const LOGO_MAP: Record<string, string> = {
  BTC: "/logos/bitcoin.svg",
  ETH: "/logos/ethereum.svg",
  SOL: "/logos/solana.svg",
}

export function TemplateBold({
  handle,
  bio,
  avatarUrl,
  createdAt,
  addresses,
  isOwnProfile,
  isLoggedIn: _isLoggedIn,
  onAvatarUpload,
  avatarUploading,
  onBioEdit,
  onSend,
  sendOwnProfile,
  sendLoginMsg,
  badges = [],
  contentSlot,
  tipOverlay,
  isPreview = false,
}: TemplateProps) {
  const HandleTag = isPreview ? "p" : "h1"
  const [sheetAddress, setSheetAddress] = useState<DerivedAddress | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [expandedChain, setExpandedChain] = useState<string | null>(null)

  const handleCtaClick = () => {
    onSend()
  }

  const handleAddressTap = (addr: DerivedAddress) => {
    if (expandedChain === addr.chain) {
      // Open bottom sheet for full address view
      setSheetAddress(addr)
      setSheetOpen(true)
    } else {
      setExpandedChain(addr.chain)
    }
  }

  return (
    <div className="bg-template-bold min-h-[calc(100svh-3.5rem)]">
      <div className="container mx-auto px-4 max-w-lg">
        <div className="flex flex-col items-center text-center pt-8 sm:pt-14">
          {/* Large avatar with glow */}
          <div className="relative mb-4">
            <AvatarGlow handle={handle} avatarUrl={avatarUrl} size={96} />
            {isOwnProfile && !avatarUploading && (
              <button
                onClick={onAvatarUpload}
                className="absolute -top-1 -right-1 z-20 rounded-full bg-background border border-border p-1.5 shadow-sm cursor-pointer hover:bg-muted transition-colors"
                aria-label="Change profile picture"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            {isOwnProfile && avatarUploading && (
              <div className="absolute inset-0 z-20 rounded-full bg-black/50 flex items-center justify-center" style={{ width: 96, height: 96 }}>
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            {tipOverlay}
          </div>

          {/* Extra large handle */}
          <HandleTag
            className="text-4xl sm:text-[40px] font-extrabold text-palette-gradient leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            @{handle}
          </HandleTag>

          {/* Bio */}
          <p
            className={`text-base mt-2 max-w-[20rem] leading-relaxed${
              isOwnProfile
                ? " cursor-pointer hover:text-foreground transition-colors"
                : ""
            }`}
            style={{ color: "rgba(230, 233, 242, 0.6)" }}
            onClick={isOwnProfile ? onBioEdit : undefined}
          >
            {bio || "nimimo identity"}
          </p>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="mt-3">
              <BadgeRow badges={badges} />
            </div>
          )}

          {/* Hero CTA - always visible */}
          <div className="w-full mt-7">
            <HeroCta handle={handle} onClick={handleCtaClick} showOwnProfileMsg={sendOwnProfile} showLoginMsg={sendLoginMsg} />
          </div>

          {/* Inline expandable address pills */}
          {addresses.length > 0 && (
            <div className="w-full mt-6 space-y-2">
              {addresses.map((addr) => {
                const isExpanded = expandedChain === addr.chain
                const truncated = `${addr.address.slice(0, 6)}...${addr.address.slice(-4)}`

                return (
                  <button
                    key={addr.chain}
                    onClick={() => handleAddressTap(addr)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer ${
                      isExpanded
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/30 bg-card/30 hover:bg-card/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <Image
                        src={LOGO_MAP[addr.symbol] || addr.logo || "/placeholder.svg"}
                        alt={addr.symbol}
                        width={18}
                        height={18}
                        className="w-[18px] h-[18px]"
                      />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <span className="text-sm font-medium text-foreground">{addr.name}</span>
                      {isExpanded && (
                        <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                          {truncated}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{addr.symbol}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Content cards */}
          {contentSlot && <div className="mt-5">{contentSlot}</div>}

          {/* Member since */}
          <div className="mt-8 pb-10 flex items-center gap-2" style={{ color: "rgba(230, 233, 242, 0.5)" }}>
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-xs">Member since {createdAt}</span>
          </div>
        </div>
      </div>

      <AddressBottomSheet
        address={sheetAddress}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
