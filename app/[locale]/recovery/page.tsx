"use client"

import { logger } from "@/lib/logger"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useOwnership } from "@/components/ownership-provider"
import type { OwnershipRecord } from "@/lib/ownership/indexeddb"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { CreateRecoveryCard } from "./components/create-recovery-card"
import { VerifyRecoveryCard } from "./components/verify-recovery-card"
import { RotateRecoveryCard } from "./components/rotate-recovery-card"

const log = logger("recovery")

type FlowState = "create" | "verify" | "rotate"

function RecoveryContent() {
  const t = useTranslations("recovery")
  const { status: sessionStatus } = useSession()
  const searchParams = useSearchParams()
  const { status, ownershipId, identity, recoveryState, getManager, refreshRecoveryState } = useOwnership()
  const [record, setRecord] = useState<OwnershipRecord | null>(null)
  const [recordLoaded, setRecordLoaded] = useState(false)
  const [overrideFlow, setOverrideFlow] = useState<FlowState | null>(null)

  // Load the full OwnershipRecord once the context is ready
  useEffect(() => {
    if (status !== "ready" || !ownershipId) return
    getManager()
      .then((m) => m.db.getOwnership(ownershipId))
      .then((r) => {
        if (r) setRecord(r)
        setRecordLoaded(true)
      })
  }, [status, ownershipId, getManager])

  // Derive flowState from context's recoveryState + searchParams
  const flowState: FlowState = useMemo(() => {
    const param = searchParams.get("flow") as FlowState | null
    if (param && ["create", "verify", "rotate"].includes(param)) return param
    if (recoveryState === "created") return "verify"
    if (recoveryState === "verified") return "rotate"
    return "create"
  }, [recoveryState, searchParams])

  const activeFlow = overrideFlow ?? flowState

  const reloadAndRefresh = async () => {
    if (!ownershipId) return
    const m = await getManager()
    const updated = await m.db.getOwnership(ownershipId)
    if (updated) setRecord(updated)
    await refreshRecoveryState()
  }

  const handleRecoveryCreated = async () => {
    if (!record) return
    try {
      const m = await getManager()
      await m.db.updateOwnership(record.ownership_id, {
        recovery: { state: "created", method: record.recovery?.method || "password", lastCreatedAt: Date.now(), lastVerifiedAt: null },
        protection: "recovery",
      })
      await reloadAndRefresh()
      setOverrideFlow("verify")
    } catch (error) {
      log.error("Error updating ownership", error)
    }
  }

  const handleRecoveryVerified = async () => {
    if (!record) return
    try {
      const m = await getManager()
      await m.db.updateOwnership(record.ownership_id, {
        recovery: { state: "verified", method: record.recovery?.method || "password", lastCreatedAt: record.recovery?.lastCreatedAt || Date.now(), lastVerifiedAt: Date.now() },
      })
      await reloadAndRefresh()
    } catch (error) {
      log.error("Error updating ownership", error)
    }
  }

  const handleRecoveryRotated = async () => {
    if (!record) return
    try {
      const m = await getManager()
      await m.db.updateOwnership(record.ownership_id, {
        recovery: { state: "created", method: record.recovery?.method || "password", lastCreatedAt: Date.now(), lastVerifiedAt: null },
      })
      await reloadAndRefresh()
      setOverrideFlow("verify")
    } catch (error) {
      log.error("Error updating ownership", error)
    }
  }

  if (sessionStatus === "unauthenticated") redirect("/")

  if (sessionStatus === "loading" || status === "loading" || (status === "ready" && !recordLoaded)) {
    return (
      <div className="bg-background flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (recordLoaded && !record) {
    return (
      <div className="bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{t("noIdentityTitle")}</CardTitle>
            <CardDescription>{t("noIdentityDescription")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // For create/rotate flows, identity is required. If record exists but identity is null,
  // the user genuinely has no handle assigned - show a helpful message instead of blank page.
  const needsIdentity = activeFlow === "create" || activeFlow === "rotate"
  if (record && needsIdentity && !identity) {
    return (
      <div className="bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{t("noIdentityTitle")}</CardTitle>
            <CardDescription>{t("noIdentityDescription")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-[calc(100dvh-3.5rem)] flex items-center justify-center p-4">
      <main className="w-full max-w-2xl">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {activeFlow === "create" && record && identity && (
            <CreateRecoveryCard ownership={record} identity={identity} onRecoveryCreated={handleRecoveryCreated} />
          )}
          {activeFlow === "verify" && record && (
            <VerifyRecoveryCard ownership={record} onVerified={handleRecoveryVerified} />
          )}
          {activeFlow === "rotate" && record && identity && (
            <RotateRecoveryCard ownership={record} identity={identity} onRecoveryRotated={handleRecoveryRotated} />
          )}
        </div>
      </main>
    </div>
  )
}

export default function RecoveryPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RecoveryContent />
    </Suspense>
  )
}
