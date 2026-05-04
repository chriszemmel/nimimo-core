"use client"

import { useState, useRef, useEffect } from "react"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicChainCardList } from "@/components/public-chain-card-list"
import { CroodlesAvatar } from "@/components/croodles-avatar"
import { ProfileSendCta } from "@/components/profile/profile-send-cta"
import { ProfileInfoCarousel } from "@/components/profile/profile-info-carousel"
import { BadgeRow } from "@/components/profile/badge-pill"
import type { TemplateProps } from "./types"

export function TemplateClassic({
  handle,
  bio,
  avatarUrl,
  createdAt,
  addresses,
  isOwnProfile,
  isLoggedIn: _isLoggedIn,
  onAvatarUpload,
  onAvatarDelete,
  avatarUploading,
  onBioEdit,
  onSend: _onSend,
  badges = [],
  contentSlot,
  tipOverlay,
  isPreview = false,
}: TemplateProps) {
  const HandleTag = isPreview ? "p" : "h1"
  const [avatarError, setAvatarError] = useState(false)
  const [avatarLoaded, setAvatarLoaded] = useState(false)
  const avatarImgRef = useRef<HTMLImageElement>(null)

  // Handle cached images where onLoad may not fire (especially Safari)
  useEffect(() => {
    const img = avatarImgRef.current
    if (!img || !avatarUrl) return
    if (img.complete && img.naturalWidth > 0) {
      setAvatarLoaded(true)
      return
    }
    const raf = requestAnimationFrame(() => {
      if (img.complete && img.naturalWidth > 0) {
        setAvatarLoaded(true)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [avatarUrl])

  const addressPairs = addresses.map((a) => ({ chain: a.chain, address: a.address }))

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 max-w-2xl">
      <div className="space-y-3 sm:space-y-4">
        {/* Avatar + Handle */}
        <div className="flex flex-col items-center text-center gap-2 sm:gap-3 py-1 sm:py-2">
          <div className="relative">
            {avatarUrl && !avatarError ? (
              <div className="relative rounded-full overflow-hidden" style={{ width: 80, height: 80 }}>
                {!avatarLoaded && (
                  <div className="absolute inset-0 rounded-full bg-secondary animate-pulse" />
                )}
                <img
                  ref={avatarImgRef}
                  src={avatarUrl}
                  alt={`@${handle}`}
                  className="w-full h-full object-cover"
                  onLoad={() => setAvatarLoaded(true)}
                  onError={() => setAvatarError(true)}
                />
              </div>
            ) : (
              <CroodlesAvatar handle={handle} size={80} />
            )}
            {isOwnProfile && !avatarUploading && (
              <>
                <button
                  onClick={onAvatarUpload}
                  className="absolute -top-1 -right-1 rounded-full bg-background border border-border p-1.5 shadow-sm cursor-pointer hover:bg-muted transition-colors"
                  aria-label="Change profile picture"
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
                {avatarUrl && (
                  <button
                    onClick={onAvatarDelete}
                    className="absolute -bottom-1 -right-1 rounded-full bg-background border border-border p-1.5 shadow-sm cursor-pointer hover:bg-muted transition-colors"
                    aria-label="Remove profile picture"
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </>
            )}
            {isOwnProfile && avatarUploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            {tipOverlay}
          </div>
          <div className="flex flex-col items-center">
            <HandleTag
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-gradient"
              style={{ fontFamily: "var(--font-display)" }}
            >
              @{handle}
            </HandleTag>
            <p
              className={`text-sm text-muted-foreground mt-1 truncate max-w-[16rem] text-center${
                isOwnProfile ? " cursor-pointer hover:text-foreground transition-colors" : ""
              }`}
              onClick={isOwnProfile ? onBioEdit : undefined}
            >
              {bio || "nimimo identity"}
            </p>
            {badges.length > 0 && (
              <div className="mt-2">
                <BadgeRow badges={badges} />
              </div>
            )}
          </div>
        </div>

        {/* Send CTA - always visible, login-gated */}
        <ProfileSendCta handle={handle} addresses={addressPairs} />

        {/* Receiving addresses */}
        {addresses.length > 0 && (
          <Card className="shadow-sm py-3 sm:py-4 gap-2 sm:gap-3">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm sm:text-base">Receiving addresses</CardTitle>
            </CardHeader>
            <CardContent className="pb-0">
              <PublicChainCardList addresses={addresses} />
            </CardContent>
          </Card>
        )}

        {/* Content cards */}
        {contentSlot}

        {/* Info carousel */}
        <div className="pb-10">
          <ProfileInfoCarousel createdAt={createdAt} />
        </div>
      </div>
    </div>
  )
}
