"use client"

import { logger } from "@/lib/logger"
import { useState, useEffect } from "react"
import { useLocale, useTranslations } from "next-intl"
import { apiFetch } from "@/lib/api-fetch"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import type { OwnershipRecord } from "@/lib/ownership/indexeddb"

const log = logger("identity")

interface OwnershipWithHandle extends OwnershipRecord {
  handle?: string | null
}

interface UnlinkedOwnershipAlertProps {
  ownerships?: OwnershipRecord[]
  identity?: string | null
  onLinkOwnership: (ownershipId: string) => void
  onWipeOwnership: (ownershipId: string) => void
  onIgnore: () => void
}

export function UnlinkedOwnershipAlert({
  ownerships = [],
  identity: _identity,
  onLinkOwnership,
  onWipeOwnership,
  onIgnore,
}: UnlinkedOwnershipAlertProps) {
  const t = useTranslations("identity.unlinkedAlert")
  const locale = useLocale()
  const [ownershipsWithHandles, setOwnershipsWithHandles] = useState<OwnershipWithHandle[]>([])

  useEffect(() => {
    const fetchHandles = async () => {
      if (!ownerships || ownerships.length === 0) {
        return
      }

      // Batch-fetch all handles in a single request
      let handles: Record<string, string | null> = {}
      const ids = ownerships.map((o) => o.ownership_id)
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
        log.error("Error batch-fetching handles", error)
      }

      const withHandles = ownerships.map((o) => ({
        ...o,
        handle: handles[o.ownership_id] ?? null,
      }))
      setOwnershipsWithHandles(withHandles)
    }

    fetchHandles()
  }, [ownerships])

  if (!ownerships || ownerships.length === 0) return null

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t("title")}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                {ownerships.length === 1
                  ? t("bodyOne", { count: ownerships.length })
                  : t("bodyMany", { count: ownerships.length })}
              </p>
            </div>

            {ownershipsWithHandles.map((ownership) => (
              <div key={ownership.ownership_id} className="bg-white dark:bg-black/20 rounded-lg p-3 space-y-2">
                <div className="text-xs space-y-1">
                  {ownership.handle ? (
                    <div className="font-mono font-semibold text-accent text-sm">@{ownership.handle}</div>
                  ) : (
                    <div className="font-mono text-sm text-muted-foreground italic">{t("handlePending")}</div>
                  )}
                  <div className="text-muted-foreground">
                    <div>{t("createdLabel", { date: new Date(ownership.createdAt).toLocaleDateString(locale) })}</div>
                    <div>
                      {t("protectionLine", {
                        protection: ownership.protection,
                        recovery: ownership.recovery?.state || t("recoveryNone"),
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => onLinkOwnership(ownership.ownership_id)}>
                    {t("linkNow")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 bg-transparent"
                    onClick={() => onWipeOwnership(ownership.ownership_id)}
                  >
                    {t("wipe")}
                  </Button>
                </div>
              </div>
            ))}

            <Button size="sm" variant="ghost" onClick={onIgnore} className="text-xs">
              {t("ignoreForNow")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
