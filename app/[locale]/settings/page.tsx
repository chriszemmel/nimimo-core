"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useTranslations } from "next-intl"
import { useOwnership } from "@/components/ownership-provider"
import { apiFetch } from "@/lib/api-fetch"
import { resizeImageToAvatar } from "@/lib/image-resize"
import { getAllTemplates, PALETTES } from "@/components/profile/templates"
import type { PaletteId, TemplateProps } from "@/components/profile/templates"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"
import { Check, Eye, Loader2, Pencil, Trash2, X } from "lucide-react"
import { CroodlesAvatar } from "@/components/croodles-avatar"
import { BadgeRow } from "@/components/profile/badge-pill"
import { logger } from "@/lib/logger"

const log = logger("settings")

const PREVIEW_ADDRESSES: DerivedAddress[] = [
  { chain: "bitcoin", symbol: "BTC", name: "Bitcoin", address: "bc1q...preview", derivationPath: "", logo: "/logos/bitcoin.svg" },
  { chain: "ethereum", symbol: "ETH", name: "Ethereum", address: "0x...preview", derivationPath: "", logo: "/logos/ethereum.svg" },
  { chain: "solana", symbol: "SOL", name: "Solana", address: "So1...preview", derivationPath: "", logo: "/logos/solana.svg" },
]

type PendingChanges = {
  template?: string
  palette?: PaletteId
  avatarBase64?: string | null
  bio?: string
}

export default function SettingsPage() {
  const t = useTranslations("settings")
  const tCommon = useTranslations("common")
  const { status: sessionStatus } = useSession()
  const { ownershipId, identity, status: ownershipStatus } = useOwnership()

  const [currentTemplate, setCurrentTemplate] = useState<string>("classic")
  const [currentPalette, setCurrentPalette] = useState<PaletteId>("default")
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null)
  const [currentBio, setCurrentBio] = useState("")
  const [badges, setBadges] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  const [pending, setPending] = useState<PendingChanges>({})
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bioInputRef = useRef<HTMLInputElement>(null)
  const [editingBio, setEditingBio] = useState(false)

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      redirect("/auth/login")
    }
  }, [sessionStatus])

  useEffect(() => {
    if (!ownershipId) return
    setLoaded(false)
    setPending({})
    setAvatarPreview(null)
    Promise.all([
      apiFetch(`/api/identity/by-ownership/${ownershipId}`).then((r) => r.ok ? r.json() : null),
      apiFetch(`/api/identity/lookup?handle=${encodeURIComponent(identity || "")}`).then((r) => r.ok ? r.json() : null),
    ]).then(([identityData, lookupData]) => {
      setCurrentTemplate((identityData?.profile_template as string) ?? "classic")
      setCurrentPalette((identityData?.profile_palette as PaletteId) ?? "default")
      setBadges(Array.isArray(identityData?.badges) ? identityData.badges : [])
      setCurrentAvatarUrl(lookupData?.avatar_url ?? null)
      setCurrentBio(lookupData?.bio ?? "")
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [ownershipId, identity])

  const hasPendingChanges =
    pending.template !== undefined ||
    pending.palette !== undefined ||
    pending.avatarBase64 !== undefined ||
    pending.bio !== undefined

  const displayTemplate = pending.template ?? currentTemplate
  const displayPalette = pending.palette ?? currentPalette
  const currentTmplEntry = getAllTemplates().find((tm) => tm.id === displayTemplate)
  const isLightTemplate = currentTmplEntry?.light ?? false
  const isThemedTemplate = currentTmplEntry?.themed ?? false
  const hidePalette = isLightTemplate || isThemedTemplate
  const displayBio = pending.bio ?? currentBio
  const displayAvatarUrl = avatarPreview !== null
    ? (avatarPreview || null)
    : currentAvatarUrl

  const handleTemplateSelect = (id: string) => {
    if (id === currentTemplate && pending.template === undefined) return
    if (id === currentTemplate) {
      setPending((p) => { const { template: _, ...rest } = p; return rest })
    } else {
      setPending((p) => ({ ...p, template: id }))
    }
  }

  const handlePaletteSelect = (id: PaletteId) => {
    if (id === currentPalette && pending.palette === undefined) return
    if (id === currentPalette) {
      setPending((p) => { const { palette: _, ...rest } = p; return rest })
    } else {
      setPending((p) => ({ ...p, palette: id }))
    }
  }

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    try {
      const base64 = await resizeImageToAvatar(file)
      setPending((p) => ({ ...p, avatarBase64: base64 }))
      setAvatarPreview(base64)
    } catch (err) {
      log.error("Avatar resize error", err)
    }
  }

  const handleAvatarDelete = () => {
    setPending((p) => ({ ...p, avatarBase64: null }))
    setAvatarPreview("")
  }

  const handleBioSave = (value: string) => {
    const trimmed = value.trim()
    if (trimmed === currentBio) {
      setPending((p) => { const { bio: _, ...rest } = p; return rest })
    } else {
      setPending((p) => ({ ...p, bio: trimmed }))
    }
    setEditingBio(false)
  }

  const handleDiscard = () => {
    setPending({})
    setAvatarPreview(null)
    setEditingBio(false)
  }

  const handleApply = useCallback(async () => {
    if (!ownershipId) return
    setApplying(true)

    try {
      if (pending.template !== undefined) {
        const res = await apiFetch("/api/identity/update-template", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template: pending.template, ownership_id: ownershipId }),
        })
        if (res.ok) setCurrentTemplate(pending.template)
        else log.error("Failed to save template", res.status)
      }

      if (pending.palette !== undefined) {
        const res = await apiFetch("/api/identity/update-palette", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ palette: pending.palette, ownership_id: ownershipId }),
        })
        if (res.ok) setCurrentPalette(pending.palette)
        else log.error("Failed to save palette", res.status)
      }

      if (pending.avatarBase64 !== undefined) {
        if (pending.avatarBase64 === null) {
          const res = await apiFetch(`/api/identity/avatar?ownership_id=${ownershipId}`, { method: "DELETE" })
          if (res.ok) setCurrentAvatarUrl(null)
        } else {
          const res = await apiFetch("/api/identity/avatar", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownership_id: ownershipId, image: pending.avatarBase64 }),
          })
          if (res.ok) {
            const data = await res.json()
            setCurrentAvatarUrl(data.avatar_url)
          }
        }
      }

      if (pending.bio !== undefined) {
        const res = await apiFetch("/api/identity/update-bio", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bio: pending.bio, ownership_id: ownershipId }),
        })
        if (res.ok) setCurrentBio(pending.bio)
        else log.error("Failed to save bio", res.status)
      }

      setPending({})
      setAvatarPreview(null)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
    } catch (err) {
      log.error("Apply changes error", err)
    }
    setApplying(false)
  }, [pending, ownershipId])

  const isLoading = (
    sessionStatus === "loading" ||
    ownershipStatus === "loading" ||
    !loaded ||
    (ownershipStatus === "ready" && !identity)
  ) && sessionStatus !== "unauthenticated"

  if (isLoading) {
    return (
      <div className="min-h-[calc(100svh-3.5rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  const handle = identity || "you"
  const noop = () => {}

  return (
    <div className="container mx-auto px-4 py-6 sm:py-10 max-w-4xl pb-28">
      <div className="mb-8 sm:mb-10">
        <h1
          className="text-2xl sm:text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.rich("personalize", {
            handle: () =>
              identity ? (
                <a
                  href={`/@${identity}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                  title={t("previewProfile")}
                >
                  @{handle}
                  <Eye className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span>@{handle}</span>
              ),
          })}
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "var(--font-display)" }}>
          {t("yourProfile")}
        </h2>
        <div className="rounded-2xl border border-border/40 bg-card/30 p-5 space-y-5">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              {displayAvatarUrl ? (
                <div className="relative rounded-full overflow-hidden" style={{ width: 64, height: 64 }}>
                  <img src={displayAvatarUrl} alt={`@${handle}`} className="w-full h-full object-cover" />
                </div>
              ) : (
                <CroodlesAvatar handle={handle} size={64} />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleAvatarPick}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -top-1 -right-1 rounded-full bg-background border border-border p-1 shadow-sm cursor-pointer hover:bg-muted transition-colors"
                aria-label={t("changeAvatarAria")}
              >
                <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
              {displayAvatarUrl && (
                <button
                  onClick={handleAvatarDelete}
                  className="absolute -bottom-1 -right-1 rounded-full bg-background border border-border p-1 shadow-sm cursor-pointer hover:bg-muted transition-colors"
                  aria-label={t("removeAvatarAria")}
                >
                  <Trash2 className="w-2.5 h-2.5 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                @{handle}
              </p>
              {editingBio ? (
                <div className="fixed inset-0 h-[100dvh] z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingBio(false) }}>
                  <div className="bg-card rounded-2xl border border-border p-5 max-w-sm w-full space-y-3">
                    <p className="text-sm font-medium text-foreground">{t("editStatus")}</p>
                    <input
                      ref={bioInputRef}
                      type="text"
                      defaultValue={displayBio}
                      maxLength={60}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleBioSave((e.target as HTMLInputElement).value) }
                        if (e.key === "Escape") setEditingBio(false)
                      }}
                      className="w-full text-sm text-foreground bg-background border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 transition-colors"
                      style={{ fontSize: "16px" }}
                      placeholder={t("statusPlaceholder")}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingBio(false)}
                        className="flex-1 text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                      >
                        {tCommon("cancel")}
                      </button>
                      <button
                        onClick={() => bioInputRef.current && handleBioSave(bioInputRef.current.value)}
                        className="flex-1 text-sm font-medium text-primary hover:text-primary/80 py-1.5 transition-colors"
                      >
                        {tCommon("apply")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              <p
                className="text-sm text-muted-foreground mt-0.5 cursor-pointer hover:text-foreground transition-colors truncate"
                onClick={() => setEditingBio(true)}
              >
                {displayBio || t("statusPlaceholder")}
                {pending.bio !== undefined && (
                  <span className="ml-1 text-xs text-primary">{t("edited")}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {badges.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "var(--font-display)" }}>
            {t("yourBadges")}
          </h2>
          <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
            <BadgeRow badges={badges} size="md" />
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4" style={{ fontFamily: "var(--font-display)" }}>
          {t("chooseLayout")}
        </h2>

        <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-2" style={{ width: "max-content" }}>
            {getAllTemplates().map((tmpl) => {
              const isSelected = tmpl.id === displayTemplate
              const TemplateComponent = tmpl.component

              const previewProps: TemplateProps = {
                handle,
                bio: displayBio || "Your status here",
                avatarUrl: displayAvatarUrl,
                createdAt: "March 2026",
                addresses: PREVIEW_ADDRESSES,
                isOwnProfile: false,
                isLoggedIn: true,
                onAvatarUpload: noop,
                onAvatarDelete: noop,
                avatarUploading: false,
                onBioEdit: noop,
                onSend: noop,
              }

              return (
                <div
                  key={tmpl.id}
                  className={`relative flex-shrink-0 w-[260px] sm:w-[280px] rounded-2xl border-2 overflow-hidden transition-all ${
                    isSelected
                      ? tmpl.light
                        ? "border-neutral-400 shadow-lg shadow-black/5"
                        : "border-primary shadow-lg shadow-primary/10"
                      : "border-border/40 hover:border-border/80"
                  }`}
                >
                  {isSelected && (
                    <div className={`absolute top-3 right-3 z-30 w-6 h-6 rounded-full flex items-center justify-center ${
                      tmpl.light ? "bg-neutral-800" : "bg-primary"
                    }`}>
                      <Check className={`w-3.5 h-3.5 ${tmpl.light ? "text-white" : "text-primary-foreground"}`} />
                    </div>
                  )}

                  <div
                    className="relative h-[280px] sm:h-[320px] overflow-hidden cursor-pointer"
                    onClick={() => setPreviewTemplate(tmpl.id)}
                  >
                    <div
                      className={`origin-top-left pointer-events-none${tmpl.light ? "" : tmpl.themed ? ` themed-${tmpl.id}` : ` palette-${displayPalette}`}`}
                      style={{ transform: "scale(0.42)", width: "238%", height: "238%" }}
                    >
                      <TemplateComponent {...previewProps} />
                    </div>
                    <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t ${tmpl.light ? "from-white/80" : "from-card"} to-transparent`} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
                      <span className="text-xs font-medium text-white bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
                        {tCommon("view")}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTemplateSelect(tmpl.id)}
                    className={`w-full px-4 py-3 border-t text-left cursor-pointer transition-colors ${
                      tmpl.light
                        ? "bg-white/90 border-neutral-200 hover:bg-white"
                        : "bg-card border-border/30 hover:bg-card/80"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${tmpl.light ? "text-neutral-800" : "text-foreground"}`}>{tmpl.name}</p>
                    <p className={`text-xs mt-0.5 ${tmpl.light ? "text-neutral-400" : "text-muted-foreground"}`}>{tmpl.description}</p>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {hidePalette ? (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{t("colorPalette")}</h3>
            <p className="text-xs text-muted-foreground/70">
              {isLightTemplate ? t("lightTemplateHint") : t("themedTemplateHint")}
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{t("colorPalette")}</h3>
            <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-3 pb-1" style={{ width: "max-content" }}>
                {PALETTES.map((pal) => {
                  const isSelected = pal.id === displayPalette
                  return (
                    <button
                      key={pal.id}
                      onClick={() => handlePaletteSelect(pal.id)}
                      className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? "border-primary bg-card/50"
                          : "border-border/30 hover:border-border/60"
                      }`}
                    >
                      <div
                        className="w-12 h-12 rounded-lg"
                        style={{
                          background: `linear-gradient(135deg, ${pal.colors[0]} 0%, ${pal.colors[1]} 50%, ${pal.colors[2]} 100%)`,
                        }}
                      />
                      <span className="text-[11px] text-muted-foreground">{pal.name}</span>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {previewTemplate && (() => {
        const tmpl = getAllTemplates().find((tm) => tm.id === previewTemplate)
        if (!tmpl) return null
        const PreviewComponent = tmpl.component
        const isAlreadySelected = previewTemplate === displayTemplate
        const isLight = !!tmpl.light
        return (
          <div className={`fixed inset-0 z-[60] flex flex-col ${isLight ? "bg-white" : "bg-background"}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b backdrop-blur-xl shrink-0 ${
              isLight ? "border-neutral-200 bg-white/80" : "border-border/40 bg-card/80"
            }`}>
              <button
                onClick={() => setPreviewTemplate(null)}
                className={`flex items-center gap-1.5 text-sm transition-colors cursor-pointer ${
                  isLight ? "text-neutral-400 hover:text-neutral-800" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <X className="w-4 h-4" />
                {tCommon("close")}
              </button>
              <span className={`text-sm font-medium ${isLight ? "text-neutral-800" : "text-foreground"}`}>{tmpl.name}</span>
              <button
                onClick={() => {
                  handleTemplateSelect(previewTemplate)
                  setPreviewTemplate(null)
                }}
                className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  isAlreadySelected
                    ? isLight ? "text-neutral-400 bg-neutral-100" : "text-muted-foreground bg-muted"
                    : isLight ? "text-white bg-neutral-800" : "text-primary-foreground bg-primary"
                }`}
              >
                {isAlreadySelected ? t("selected") : t("useThis")}
              </button>
            </div>
            <div className={`flex-1 overflow-y-auto${tmpl.light ? " light-template" : tmpl.themed ? ` themed-${tmpl.id}` : ` palette-${displayPalette}`}`}>
              <PreviewComponent
                handle={handle}
                bio={displayBio || "Your status here"}
                avatarUrl={displayAvatarUrl}
                createdAt="March 2026"
                addresses={PREVIEW_ADDRESSES}
                isOwnProfile={false}
                isLoggedIn={true}
                onAvatarUpload={noop}
                onAvatarDelete={noop}
                avatarUploading={false}
                onBioEdit={noop}
                onSend={noop}
              />
            </div>
          </div>
        )
      })()}

      {hasPendingChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-200 flex justify-center pb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              className="h-9 px-5 text-[13px] font-medium text-muted-foreground bg-card/90 backdrop-blur-xl border border-border/40 rounded-full cursor-pointer hover:text-foreground hover:bg-card transition-colors shadow-lg shadow-black/20"
            >
              {tCommon("discard")}
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="h-9 px-5 text-[13px] font-semibold text-background bg-palette-gradient rounded-full cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-black/20"
              style={{ background: "linear-gradient(90deg, var(--p-start, #3CF2D6) 0%, var(--p-end, #7B61FF) 100%)" }}
            >
              {applying ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {tCommon("saving")}</>
              ) : (
                tCommon("apply")
              )}
            </button>
          </div>
        </div>
      )}

      {showSuccess && !hasPendingChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium shadow-lg">
            <Check className="w-4 h-4" />
            {tCommon("saved")}
            {identity && (
              <a
                href={`/@${identity}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                {tCommon("view")}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
