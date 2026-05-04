"use client"

import { logger } from "@/lib/logger"
import { useState, useEffect, useCallback } from "react"
import { useTranslations, useLocale } from "next-intl"
import { apiFetch } from "@/lib/api-fetch"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Wallet, Check } from "lucide-react"
import { useOwnership } from "@/components/ownership-provider"
import type { OwnershipRecord } from "@/lib/ownership/indexeddb"

const log = logger("ownership")

interface OwnershipSwitcherProps {
  currentOwnershipId: string
  accessId: string
  onSwitch: (ownershipId: string) => void
}

interface OwnershipWithIdentity extends OwnershipRecord {
  identity?: string | null
}

export function OwnershipSwitcher({ currentOwnershipId, accessId, onSwitch }: OwnershipSwitcherProps) {
  const t = useTranslations("ownershipSwitcher")
  const locale = useLocale()

  const ownership = useOwnership()
  const { getManager, switchOwnership: ownershipSwitchOwnership, recoveryState: contextRecoveryState, ownershipId: contextOwnershipId } = ownership
  const [ownerships, setOwnerships] = useState<OwnershipWithIdentity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)

  const loadOwnerships = useCallback(async () => {
    setIsLoading(true)
    try {
      const manager = await getManager()
      const boundOwnerships = await manager.getBoundOwnerships(accessId)

      // Batch-fetch all handles in a single request
      let handles: Record<string, string | null> = {}
      const ids = boundOwnerships.map((o) => o.ownership_id)
      if (ids.length > 0) {
        try {
          const res = await apiFetch("/api/identity/handles-by-ownership", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownership_ids: ids }),
          })
          if (res.ok) {
            const data = await res.json()
            handles = data.handles ?? {}
          }
        } catch (error) {
          log.error("Error batch-fetching identity handles", error)
        }
      }

      const ownershipsWithIdentities = boundOwnerships.map((o) => ({
        ...o,
        identity: handles[o.ownership_id] ?? null,
      }))

      setOwnerships(ownershipsWithIdentities)
    } catch (error) {
      log.error("Error loading ownerships", error)
    } finally {
      setIsLoading(false)
    }
  }, [accessId, getManager])

  useEffect(() => {
    loadOwnerships()
  }, [contextOwnershipId, loadOwnerships])

  const handleSwitch = async (ownershipId: string) => {
    if (ownershipId === currentOwnershipId) return

    setIsSwitching(true)
    try {
      await ownershipSwitchOwnership(ownershipId)
      onSwitch(ownershipId)
    } catch (error) {
      log.error("Error switching ownership", error)
    } finally {
      setIsSwitching(false)
    }
  }

  // Use context's recoveryState for the icon (always fresh), local state for dropdown items
  let walletIconColor = "text-amber-500" // none/not backed up
  if (contextRecoveryState === "created") {
    walletIconColor = "text-blue-500" // backed up
  } else if (contextRecoveryState === "verified") {
    walletIconColor = "text-green-500" // verified
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="icon" className="bg-transparent hover:bg-muted/50" disabled aria-label={t("loadingAria")}>
        <Wallet className="h-4 w-4 text-muted-foreground animate-pulse" />
      </Button>
    )
  }

  if (ownerships.length === 0) {
    return null
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-transparent hover:bg-muted/50"
          disabled={isSwitching}
          aria-label={t("switchAria")}
        >
          <Wallet className={`h-4 w-4 ${walletIconColor}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-80">
        <DropdownMenuLabel>{t("yourOwnerships")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ownerships.map((ownership, index) => {
          const isActive = ownership.ownership_id === currentOwnershipId
          // For active ownership, use fresh context state; for others, use local DB state
          const recoveryState = isActive ? contextRecoveryState : (ownership.recovery?.state || "none")
          const createdDate = new Date(ownership.createdAt).toLocaleDateString(locale)

          let badgeText = t("statusNotBackedUp")
          let badgeStyle = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"

          if (recoveryState === "created") {
            badgeText = t("statusBackedUp")
            badgeStyle = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          } else if (recoveryState === "verified") {
            badgeText = t("statusVerified")
            badgeStyle = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          }

          return (
            <DropdownMenuItem
              key={ownership.ownership_id}
              onClick={() => handleSwitch(ownership.ownership_id)}
              className="cursor-pointer py-3 flex flex-col items-start gap-2 hover:bg-muted/50"
              disabled={isSwitching}
            >
              <div className="w-full flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {ownership.identity ? (
                    <span className="font-mono font-semibold text-accent">@{ownership.identity}</span>
                  ) : (
                    <span className="font-medium">{t("ownershipN", { n: index + 1 })}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyle}`}>{badgeText}</span>
                </div>
                {isActive && <Check className="h-4 w-4 text-accent" />}
              </div>
              <div className="w-full space-y-0.5">
                <p className="text-xs text-muted-foreground">{t("createdLine", { date: createdDate })}</p>
                <p className="text-xs text-muted-foreground">
                  {recoveryState === "verified" && t("statusBackedUpVerifiedLine")}
                  {recoveryState === "created" && t("statusBackedUpLine")}
                  {recoveryState === "none" && t("statusNotBackedUpLine")}
                </p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
