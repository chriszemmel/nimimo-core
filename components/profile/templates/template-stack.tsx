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

export function TemplateStack({
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

  const handleCtaClick = () => {
    onSend()
  }

  return (
    <div className="bg-template-stack min-h-[calc(100svh-3.5rem)]">
      <div className="container mx-auto px-4 max-w-md pt-8 sm:pt-14">
        {/* Identity Card */}
        <div className="relative rounded-3xl border border-border/40 bg-card/60 backdrop-blur-sm p-6 pb-7 shadow-lg shadow-black/20">
          {/* Subtle gradient accent at top */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-palette-gradient opacity-60" />

          <div className="flex flex-col items-center text-center pt-2">
            {/* Avatar */}
            <div className="relative mb-3">
              <AvatarGlow handle={handle} avatarUrl={avatarUrl} size={88} />
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
                <div className="absolute inset-0 z-20 rounded-full bg-black/50 flex items-center justify-center" style={{ width: 88, height: 88 }}>
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {tipOverlay}
            </div>

            {/* Handle */}
            <HandleTag
              className="text-[28px] font-bold text-palette-gradient leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              @{handle}
            </HandleTag>

            {/* Bio */}
            <p
              className={`text-sm mt-1.5 max-w-[16rem] leading-relaxed${
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
            <div className="w-full mt-5">
              <HeroCta handle={handle} onClick={handleCtaClick} showOwnProfileMsg={sendOwnProfile} showLoginMsg={sendLoginMsg} />
            </div>
          </div>
        </div>

        {/* Chain cards - stacked below identity card */}
        {addresses.length > 0 && (
          <div className="mt-3 space-y-2">
            {addresses.map((addr) => (
              <button
                key={addr.chain}
                onClick={() => {
                  setSheetAddress(addr)
                  setSheetOpen(true)
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/30 bg-card/40 hover:bg-card/60 transition-all cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-secondary/80 flex items-center justify-center shrink-0">
                  <Image
                    src={LOGO_MAP[addr.symbol] || addr.logo || "/placeholder.svg"}
                    alt={addr.symbol}
                    width={20}
                    height={20}
                    className="w-5 h-5"
                  />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">{addr.name}</p>
                  <p className="text-[11px] text-muted-foreground">Tap to view address</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{addr.symbol}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content cards */}
        {contentSlot && <div className="mt-4">{contentSlot}</div>}

        {/* Member since */}
        <div className="mt-6 pb-10 flex items-center justify-center gap-2" style={{ color: "rgba(230, 233, 242, 0.5)" }}>
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-xs">Member since {createdAt}</span>
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
