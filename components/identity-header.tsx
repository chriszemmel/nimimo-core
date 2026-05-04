"use client"

import { logger } from "@/lib/logger"
import { useState, useRef, useCallback, useEffect } from "react"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { CroodlesAvatar } from "./croodles-avatar"
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
import { apiFetch } from "@/lib/api-fetch"
import { resizeImageToAvatar } from "@/lib/image-resize"

const log = logger("identity-header")

interface IdentityHeaderProps {
  identity: string
  status: "active" | "backup-pending"
  ownershipId?: string
  /**
   * Whether the user has already claimed a custom handle. When explicitly
   * `false`, the header renders a small "Upgrade" pill next to the handle
   * that deep-links to /settings/handle. `null` (still loading) and `true`
   * both render nothing. Kept deliberately compact so it doesn't push the
   * Recovery card below the fold like the old full-width card did.
   */
  hasCustomHandle?: boolean | null
}

export function IdentityHeader({ identity, status, ownershipId, hasCustomHandle }: IdentityHeaderProps) {
  const t = useTranslations("identity.header")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState(false)
  const [avatarLoaded, setAvatarLoaded] = useState(false)
  const [avatarFetching, setAvatarFetching] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarImgRef = useRef<HTMLImageElement>(null)

  // Handle cached images where onLoad may not fire
  useEffect(() => {
    if (avatarImgRef.current?.complete && avatarImgRef.current.naturalWidth > 0) {
      setAvatarLoaded(true)
    }
  }, [avatarUrl])

  // Fetch avatar when identity changes.
  //
  // Seeded from a per-identity localStorage cache so navigating away
  // from /identity and back doesn't flash a pulse skeleton every time.
  // Same pattern as `nimimo:has_custom_handle` in identity/page.tsx.
  //
  // Cache key: `nimimo:avatar_url:<handle>`
  // Cache sentinels:
  //   - missing key: never fetched → show pulse + fetch (cold load)
  //   - empty string: confirmed "no avatar" → render Croodles fallback
  //     immediately, still refetch in background to catch updates
  //   - non-empty string: cached URL → render <img> immediately (browser
  //     HTTP cache serves the bytes), still refetch to catch updates
  useEffect(() => {
    if (!identity) return

    const cacheKey = `nimimo:avatar_url:${identity}`
    const cached =
      typeof window !== "undefined" ? window.localStorage.getItem(cacheKey) : null

    if (cached === null) {
      // Cold load - show the pulse until the fetch returns.
      setAvatarUrl(null)
      setAvatarError(false)
      setAvatarLoaded(false)
      setAvatarFetching(true)
    } else {
      // Warm - seed the cached value synchronously so the first paint
      // already has the avatar, no pulse. `""` = cached "no avatar".
      setAvatarUrl(cached || null)
      setAvatarError(false)
      setAvatarLoaded(false)
      setAvatarFetching(false)
    }

    apiFetch(`/api/identity/lookup?handle=${encodeURIComponent(identity)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        const freshUrl: string | null = data?.avatar_url ?? null
        // State-updater form so identical URLs bail out of the render
        // and avoid churning the <img> src (which would re-trigger
        // onLoad and flash the pulse overlay).
        setAvatarUrl((prev) => (prev === freshUrl ? prev : freshUrl))
        if (typeof window !== "undefined") {
          window.localStorage.setItem(cacheKey, freshUrl ?? "")
        }
      })
      .catch(() => {})
      .finally(() => setAvatarFetching(false))
  }, [identity])

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !ownershipId) return
    e.target.value = ""

    setAvatarUploading(true)
    setAvatarError(false)
    try {
      const base64 = await resizeImageToAvatar(file)
      const res = await apiFetch("/api/identity/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownership_id: ownershipId, image: base64 }),
      })
      if (res.ok) {
        const data = await res.json()
        setAvatarLoaded(false)
        setAvatarUrl(data.avatar_url)
        if (typeof window !== "undefined" && identity) {
          window.localStorage.setItem(`nimimo:avatar_url:${identity}`, data.avatar_url ?? "")
        }
      } else {
        log.error("Avatar upload failed", res.status)
      }
    } catch (err) {
      log.error("Avatar upload error", err)
    }
    setAvatarUploading(false)
  }, [ownershipId, identity])

  const handleAvatarDelete = useCallback(async () => {
    if (!ownershipId) return
    setAvatarUploading(true)
    try {
      const res = await apiFetch(`/api/identity/avatar?ownership_id=${ownershipId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setAvatarUrl(null)
        setAvatarError(false)
        if (typeof window !== "undefined" && identity) {
          window.localStorage.setItem(`nimimo:avatar_url:${identity}`, "")
        }
      }
    } catch (err) {
      log.error("Avatar delete error", err)
    }
    setAvatarUploading(false)
  }, [ownershipId, identity])

  const canEdit = !!ownershipId

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {avatarFetching ? (
          <div className="rounded-full bg-secondary animate-pulse" style={{ width: 48, height: 48 }} />
        ) : avatarUrl && !avatarError ? (
          <div className="relative rounded-full overflow-hidden" style={{ width: 48, height: 48 }}>
            {!avatarLoaded && (
              <div className="absolute inset-0 rounded-full bg-secondary animate-pulse" />
            )}
            <img
              ref={avatarImgRef}
              src={avatarUrl}
              alt={`@${identity}`}
              className="w-full h-full object-cover"
              onLoad={() => setAvatarLoaded(true)}
              onError={() => setAvatarError(true)}
            />
          </div>
        ) : (
          <CroodlesAvatar handle={identity} size={48} />
        )}
        {canEdit && !avatarUploading && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -top-1 -right-1 rounded-full bg-background border border-border p-1 shadow-sm cursor-pointer hover:bg-muted transition-colors"
              aria-label={t("changeAvatarAria")}
            >
              <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            {avatarUrl && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="absolute -bottom-1 -right-1 rounded-full bg-background border border-border p-1 shadow-sm cursor-pointer hover:bg-muted transition-colors"
                aria-label={t("removeAvatarAria")}
              >
                <Trash2 className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            )}
          </>
        )}
        {canEdit && avatarUploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tap the handle to preview the public profile - replaces
              the old standalone eye icon button, mirroring how X,
              Instagram, etc. make the username itself the canonical
              link to the profile. */}
          <a
            href={`/@${identity}`}
            target="_blank"
            rel="noopener noreferrer"
            className={
              hasCustomHandle
                ? "handle-gradient-shift text-xl font-semibold hover:opacity-80 transition-opacity"
                : "text-xl font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            }
            title={t("previewProfile")}
            aria-label={t("viewPublicProfileAria", { handle: identity })}
          >
            @{identity}
          </a>
          {hasCustomHandle === false && (
            <Link
              href="/settings/handle"
              className="upgrade-shimmer inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold shrink-0"
              title={t("upgradeTitle")}
            >
              <span className="text-brand-gradient">{t("upgrade")}</span>
            </Link>
          )}
        </div>
        <span className="text-xs text-green-600/70 dark:text-green-400/70">
          {status === "active" ? t("statusActive") : t("statusBackupPending")}
        </span>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeAvatarTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeAvatarBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("removeAvatarCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDeleteConfirm(false); handleAvatarDelete() }}>
              {t("removeAvatarConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
