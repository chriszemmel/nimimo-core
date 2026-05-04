"use client"

import { logger } from "@/lib/logger"
import type { Session } from "next-auth"
import { apiFetch } from "@/lib/api-fetch"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Info, Loader2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { useState, useEffect, useMemo } from "react"

const log = logger("identity")

interface OwnershipPromptProps {
  session: Session
  localOwnerships: OwnershipWithHandle[]
  selectedOwnerships: Set<string>
  onToggleSelection: (ownership_id: string) => void
  onBindSelected: () => void
  onCreateNew: () => void | Promise<void>
  isNewUser?: boolean
}

interface OwnershipWithHandle {
  ownership_id: string
  createdAt: number
  protection?: string
  recovery: {
    state: "none" | "created" | "verified"
    method: null | "pin" | "password"
    lastCreatedAt: number | null
    lastVerifiedAt: number | null
  }
  handle?: string | null
}

export function OwnershipPrompt({
  session: _session,
  localOwnerships,
  selectedOwnerships,
  onToggleSelection,
  onBindSelected,
  onCreateNew,
  isNewUser = false,
}: OwnershipPromptProps) {
  const t = useTranslations("identity.ownershipPrompt")
  const locale = useLocale()
  const [ownershipsWithHandles, setOwnershipsWithHandles] = useState<OwnershipWithHandle[]>([])
  const [isLoadingHandles, setIsLoadingHandles] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isBinding, setIsBinding] = useState(false)

  const safeLocalOwnerships = useMemo(
    () => (Array.isArray(localOwnerships) ? localOwnerships : []),
    [localOwnerships],
  )

  useEffect(() => {
    if (safeLocalOwnerships.length === 0) {
      setOwnershipsWithHandles([])
      return
    }

    setIsLoadingHandles(true)
    const fetchHandles = async () => {
      try {
        const ids = safeLocalOwnerships.map((o) => o.ownership_id)
        const response = await apiFetch("/api/identity/handles-by-ownership", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownership_ids: ids }),
        })
        if (response.ok) {
          const { handles } = await response.json()
          setOwnershipsWithHandles(
            safeLocalOwnerships.map((o) => ({ ...o, handle: handles[o.ownership_id] || null })),
          )
        } else {
          setOwnershipsWithHandles(safeLocalOwnerships.map((o) => ({ ...o, handle: null })))
        }
      } catch (error) {
        log.error("Error fetching handles", error)
        setOwnershipsWithHandles(safeLocalOwnerships.map((o) => ({ ...o, handle: null })))
      }
      setIsLoadingHandles(false)
    }

    fetchHandles()
  }, [safeLocalOwnerships])

  const displayOwnerships = ownershipsWithHandles.length > 0 ? ownershipsWithHandles : safeLocalOwnerships

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col bg-background">
      <main className="flex-1 container mx-auto px-4 flex items-center justify-center">
        <Card className="max-w-2xl w-full p-8 md:p-10 shadow-md my-8 md:my-0">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              {safeLocalOwnerships.length === 0 ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Info className="w-8 h-8 text-accent" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    {isNewUser ? t("welcomeNew") : t("welcomeBack")}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {t("noOwnershipBody")}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Info className="w-8 h-8 text-accent" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">{t("selectOwnershipTitle")}</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {safeLocalOwnerships.length === 1
                      ? t("selectOwnershipBodyOne", { count: safeLocalOwnerships.length })
                      : t("selectOwnershipBodyMany", { count: safeLocalOwnerships.length })}
                  </p>
                </>
              )}
            </div>

            {safeLocalOwnerships.length > 0 && (
              <div className="space-y-3 pt-4">
                <p className="text-sm font-medium text-foreground">{t("existingOwnerships")}</p>
                {displayOwnerships.map((ownership, index) => {
                  const recoveryState = ownership.recovery?.state || "none"
                  const createdDate = new Date(ownership.createdAt).toLocaleDateString(locale)
                  const isSelected = selectedOwnerships.has(ownership.ownership_id)

                  let badgeColor = ""
                  let badgeText = ""

                  if (recoveryState === "verified") {
                    badgeColor = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    badgeText = t("statusVerified")
                  } else if (recoveryState === "created") {
                    badgeColor = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    badgeText = t("statusBackedUp")
                  } else {
                    badgeColor = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    badgeText = t("statusNotBackedUp")
                  }

                  return (
                    <button
                      key={ownership.ownership_id}
                      onClick={() => onToggleSelection(ownership.ownership_id)}
                      className={`w-full p-4 border rounded-lg transition-all text-left group ${
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent hover:bg-accent/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? "border-accent bg-accent" : "border-border group-hover:border-accent"
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {isLoadingHandles ? (
                                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                              ) : ownership.handle ? (
                                <p className="text-sm font-mono font-semibold text-accent">@{ownership.handle}</p>
                              ) : (
                                <p className="text-sm font-medium text-foreground">
                                  {ownership.protection === "device" && ownership.recovery?.state === "none"
                                    ? t("importedSeed")
                                    : t("ownershipN", { n: index + 1 })}
                                </p>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
                                {badgeText}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t("createdPrefix", { date: createdDate })}</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {selectedOwnerships.size > 0 && (
              <div className="pt-2">
                <Button
                  onClick={async () => { setIsBinding(true); try { await onBindSelected() } finally { setIsBinding(false) } }}
                  disabled={isBinding}
                  className="w-full h-12 text-base"
                >
                  {isBinding ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("linking")}</>
                  ) : selectedOwnerships.size === 1 ? (
                    t("bindOne", { count: selectedOwnerships.size })
                  ) : (
                    t("bindMany", { count: selectedOwnerships.size })
                  )}
                </Button>
              </div>
            )}

            {selectedOwnerships.size === 0 && (
              <>
                <div className="pt-2">
                  <Button
                    onClick={async () => { setIsCreating(true); await onCreateNew(); setIsCreating(false) }}
                    disabled={isCreating}
                    className="w-full h-12 text-base bg-transparent"
                    variant="outline"
                  >
                    {isCreating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("creating")}</> : t("createNew")}
                  </Button>
                </div>

                <div className="pt-0">
                  <Link href="/restore" className="block">
                    <Button variant="outline" className="w-full h-12 text-base bg-transparent">
                      {t("importFromRecoveryQr")}
                    </Button>
                  </Link>
                </div>

                <div className="pt-0">
                  <Link href="/import" className="block">
                    <Button variant="outline" className="w-full h-12 text-base bg-transparent">
                      {t("importSeedPhrase")}
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}
