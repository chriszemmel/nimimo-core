"use client"

import { useState } from "react"
import { Pencil, Loader2, Calendar } from "lucide-react"
import { AvatarGlow } from "@/components/profile/avatar-glow"
import { HeroCta } from "@/components/profile/hero-cta"
import { ChainChips } from "@/components/profile/chain-chips"
import { AddressBottomSheet } from "@/components/profile/address-bottom-sheet"
import { BadgeRow } from "@/components/profile/badge-pill"
import type { TemplateProps } from "./types"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"

export function TemplateMinimal({
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

  const handleChipTap = (address: DerivedAddress) => {
    setSheetAddress(address)
    setSheetOpen(true)
  }

  const handleCtaClick = () => {
    // onSend handles login redirect and own-profile no-op
    onSend()
  }

  return (
    <div className="bg-template-minimal min-h-[calc(100svh-3.5rem)]">
      <div className="container mx-auto px-4 max-w-md">
        <div className="flex flex-col items-center text-center pt-10 sm:pt-16">
          {/* Avatar with glow */}
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
            className="text-[30px] font-bold text-palette-gradient leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            @{handle}
          </HandleTag>

          {/* Bio */}
          <p
            className={`text-sm mt-2 max-w-[16rem] leading-relaxed${
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
          <div className="w-full mt-6">
            <HeroCta handle={handle} onClick={handleCtaClick} showOwnProfileMsg={sendOwnProfile} showLoginMsg={sendLoginMsg} />
          </div>

          {/* Chain chips */}
          {addresses.length > 0 && (
            <div className="mt-5">
              <ChainChips addresses={addresses} onChipTap={handleChipTap} />
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

      {/* Address bottom sheet */}
      <AddressBottomSheet
        address={sheetAddress}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
