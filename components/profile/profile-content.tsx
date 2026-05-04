"use client"

import { logger } from "@/lib/logger"
import { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useOwnership } from "@/components/ownership-provider"
import { apiFetch } from "@/lib/api-fetch"
import { resizeImageToAvatar } from "@/lib/image-resize"
import { getTemplate } from "@/components/profile/templates"
import { Footer } from "@/components/footer"
import { useBalances } from "@/app/[locale]/wallet/hooks/use-balances"
import { SendFlow } from "@/components/send-flow"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"
import type { ChainType } from "@/components/send-flow/types"

const log = logger("profile")

interface ProfileContentProps {
  handle: string
  bio: string | null
  avatarUrl: string | null
  ownershipId: string
  createdAt: string
  addresses: DerivedAddress[]
  template?: string
  palette?: string
  badges?: string[]
}

export function ProfileContent({
  handle,
  bio: initialBio,
  avatarUrl: initialAvatarUrl,
  ownershipId: profileOwnershipId,
  createdAt,
  addresses,
  template = "classic",
  palette = "default",
  badges = [],
}: ProfileContentProps) {
  const { data: session, status: sessionStatus } = useSession()
  const { ownershipId: viewerOwnershipId, status: ownershipStatus } = useOwnership()
  const { toast } = useToast()

  const isResolved = sessionStatus !== "loading" && ownershipStatus !== "loading"
  const isOwnProfile = isResolved && !!viewerOwnershipId && viewerOwnershipId === profileOwnershipId
  const isLoggedIn = isResolved && !!session?.user

  // ── Avatar state ────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    setAvatarUploading(true)
    try {
      const base64 = await resizeImageToAvatar(file)
      const res = await apiFetch("/api/identity/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownership_id: profileOwnershipId, image: base64 }),
      })
      if (res.ok) {
        const data = await res.json()
        setAvatarUrl(data.avatar_url)
      } else {
        log.error("Avatar upload failed", res.status)
      }
    } catch (err) {
      log.error("Avatar upload error", err)
    }
    setAvatarUploading(false)
  }, [profileOwnershipId])

  const handleAvatarDelete = useCallback(async () => {
    setAvatarUploading(true)
    try {
      const res = await apiFetch(`/api/identity/avatar?ownership_id=${profileOwnershipId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setAvatarUrl(null)
      }
    } catch (err) {
      log.error("Avatar delete error", err)
    }
    setAvatarUploading(false)
  }, [profileOwnershipId])

  // ── Status/bio editing ──────────────────────────────────────────────
  const [bio, setBio] = useState(initialBio || "")
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [bioSaving, setBioSaving] = useState(false)
  const bioInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingBio && bioInputRef.current) {
      bioInputRef.current.focus()
      bioInputRef.current.selectionStart = bioInputRef.current.value.length
    }
  }, [isEditingBio])

  const saveBio = useCallback(async (newBio: string) => {
    const trimmed = newBio.trim()
    setBioSaving(true)
    try {
      const res = await apiFetch("/api/identity/update-bio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: trimmed, ownership_id: profileOwnershipId }),
      })
      if (res.ok) {
        setBio(trimmed)
      } else {
        log.error("Failed to save bio", res.status)
        toast({ title: "Failed to save bio", description: "Please try again or reload the page.", variant: "destructive" })
      }
    } catch (err) {
      log.error("Bio save error", err)
      toast({ title: "Failed to save bio", description: "Please try again or reload the page.", variant: "destructive" })
    }
    setBioSaving(false)
    setIsEditingBio(false)
  }, [profileOwnershipId, toast])

  // ── Send flow ───────────────────────────────────────────────────────
  const [sendOpen, setSendOpen] = useState(false)
  const [sendChain, setSendChain] = useState<ChainType | undefined>()
  const { ownershipId } = useOwnership()
  const { balances } = useBalances(ownershipId ?? null)

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

  const [ownProfileMsg, setOwnProfileMsg] = useState(false)
  const [loginMsg, setLoginMsg] = useState(false)

  const handleSend = useCallback((chain?: ChainType) => {
    if (!isLoggedIn) {
      setLoginMsg(true)
      setTimeout(() => setLoginMsg(false), 2500)
      return
    }
    if (!ownershipId) return
    if (isOwnProfile) {
      setOwnProfileMsg(true)
      setTimeout(() => setOwnProfileMsg(false), 2500)
      return
    }
    setSendChain(chain)
    setSendOpen(true)
  }, [isLoggedIn, ownershipId, isOwnProfile])

  // ── Resolve template ────────────────────────────────────────────────
  const templateEntry = getTemplate(template)
  const TemplateComponent = templateEntry.component
  const isLightTemplate = !!templateEntry.light
  const isThemedTemplate = !!templateEntry.themed

  // Bio editing overlay (shared across all templates)
  const bioEditOverlay = isResolved && isOwnProfile && isEditingBio ? (
    <div className="fixed inset-0 h-[100dvh] z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-card rounded-2xl border border-border p-5 max-w-sm w-full space-y-3">
        <p className="text-sm font-medium text-foreground">Edit your status</p>
        <input
          ref={bioInputRef}
          type="text"
          defaultValue={bio}
          maxLength={60}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); saveBio((e.target as HTMLInputElement).value) }
            if (e.key === "Escape") setIsEditingBio(false)
          }}
          disabled={bioSaving}
          className="w-full text-sm text-foreground bg-background border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 transition-colors"
          style={{ fontSize: "16px" }}
          placeholder="Set a status..."
        />
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditingBio(false)}
            className="flex-1 text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => bioInputRef.current && saveBio(bioInputRef.current.value)}
            disabled={bioSaving}
            className="flex-1 text-sm font-medium text-primary hover:text-primary/80 py-1.5 transition-colors disabled:opacity-50"
          >
            {bioSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  ) : null

  const paletteRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      <div
        ref={paletteRef}
        className={`${isLightTemplate ? "light-template" : isThemedTemplate ? `themed-${template}` : `palette-${palette}`} profile-entrance`}
        onAnimationEnd={() => paletteRef.current?.classList.remove("profile-entrance")}
      >
        <TemplateComponent
          handle={handle}
          bio={bio || null}
          avatarUrl={avatarUrl}
          createdAt={createdAt}
          addresses={addresses}
          isOwnProfile={isResolved && isOwnProfile}
          isLoggedIn={isResolved && isLoggedIn}
          onAvatarUpload={() => fileInputRef.current?.click()}
          onAvatarDelete={() => setShowDeleteConfirm(true)}
          avatarUploading={avatarUploading}
          onBioEdit={() => setIsEditingBio(true)}
          onSend={handleSend}
          sendOwnProfile={ownProfileMsg}
          sendLoginMsg={loginMsg}
          badges={badges}
        />
        <Footer />
      </div>

      {bioEditOverlay}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove profile picture</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your profile picture?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDeleteConfirm(false); handleAvatarDelete() }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
