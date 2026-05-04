"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { IdentitySkeleton } from "./components/identity-skeleton"
import { IdentityHeader } from "@/components/identity-header"
import { ReceiveMethodNimimo } from "@/components/receive-method-nimimo"
import { ReceiveMethodBlockchain } from "@/components/receive-method-blockchain"
import { RecoveryCard } from "./components/recovery-card"
import { OwnershipPrompt } from "./components/ownership-prompt"
import { UnlinkedOwnershipAlert } from "./components/unlinked-ownership-alert"
import { useOwnership } from "@/components/ownership-provider"
import { apiFetch } from "@/lib/api-fetch"

export default function IdentityPage() {
  const t = useTranslations("identity")
  const tCommon = useTranslations("common")
  const { data: session, status } = useSession()
  const ownership = useOwnership()

  // Only local UI state
  //
  // hasCustomHandle is cached in localStorage so returning users see the
  // gradient @handle wordmark immediately instead of flashing the plain
  // blue "non-upgraded" state for ~200ms while the API round-trips. The
  // cache is updated after every fetch below and by /settings/handle on
  // a successful upgrade.
  const [hasCustomHandle, setHasCustomHandle] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null
    const cached = window.localStorage.getItem("nimimo:has_custom_handle")
    if (cached === "true") return true
    if (cached === "false") return false
    return null
  })
  const [selectedOwnerships, setSelectedOwnerships] = useState<Set<string>>(new Set())
  const [expandedBlockchain, setExpandedBlockchain] = useState<string | null>(null)

  const displayAddresses = ownership.derivedAddresses

  // Retry loading identity if binding succeeded but identity is null
  useEffect(() => {
    if (ownership.status === "ready" && ownership.ownershipId && !ownership.identity) {
      const timer = setTimeout(() => {
        ownership.refreshOwnership()
      }, 2000)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownership.status, ownership.ownershipId, ownership.identity, ownership.refreshOwnership])

  // Scroll to top when ready
  useEffect(() => {
    if (ownership.status === "ready") {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0

      requestAnimationFrame(() => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      })
    }
  }, [ownership.status])

  // Check if user already has a custom handle
  useEffect(() => {
    if (!ownership.ownershipId) return
    apiFetch(`/api/identity/by-ownership/${ownership.ownershipId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          const value = !!data.has_custom_handle
          setHasCustomHandle(value)
          if (typeof window !== "undefined") {
            window.localStorage.setItem("nimimo:has_custom_handle", String(value))
          }
        }
      })
      .catch(() => {})
  }, [ownership.ownershipId])

  const toggleOwnershipSelection = (ownership_id: string) => {
    setSelectedOwnerships((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(ownership_id)) {
        newSet.delete(ownership_id)
      } else {
        newSet.add(ownership_id)
      }
      return newSet
    })
  }

  const handleBindSelectedOwnerships = async () => {
    if (!session?.user?.email || selectedOwnerships.size === 0) return
    await ownership.bindMultipleOwnerships(Array.from(selectedOwnerships))
    setSelectedOwnerships(new Set())
  }

  const handleCreateNewOwnership = async () => {
    await ownership.createOwnership()
  }

  const handleLinkUnlinkedOwnership = async (ownership_id: string) => {
    await ownership.bindOwnership(ownership_id)
  }

  const handleWipeUnlinkedOwnership = async (ownership_id: string) => {
    await ownership.deleteUnlinkedOwnership(ownership_id)
  }

  const handleIgnoreUnlinkedOwnership = () => {
    ownership.dismissUnlinkedAlert()
  }

  if (status === "unauthenticated") {
    redirect("/auth/login")
  }

  if (status === "loading" || ownership.status === "loading") {
    return <IdentitySkeleton />
  }

  if (ownership.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("errorLoading")}</h2>
          <p className="text-muted-foreground">{tCommon("pleaseRefresh")}</p>
        </div>
      </div>
    )
  }

  if (ownership.status === "prompt" && !ownership.isNewUser) {
    return (
      <div className="min-h-screen pb-8">
        <OwnershipPrompt
          session={session!}
          localOwnerships={ownership.localOwnerships}
          selectedOwnerships={selectedOwnerships}
          onToggleSelection={toggleOwnershipSelection}
          onBindSelected={handleBindSelectedOwnerships}
          onCreateNew={handleCreateNewOwnership}
          isNewUser={false}
        />
      </div>
    )
  }

  if (!ownership.ownershipId || !ownership.identity) {
    return <IdentitySkeleton />
  }

  return (
    <div className="flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-7 md:py-11">
        <div className="max-w-2xl mx-auto space-y-7">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>

          <IdentityHeader
            identity={ownership.identity}
            status="active"
            ownershipId={ownership.ownershipId}
            hasCustomHandle={hasCustomHandle}
          />

          {ownership.showUnlinkedAlert && ownership.unlinkedOwnerships.length > 0 && (
            <UnlinkedOwnershipAlert
              ownerships={ownership.unlinkedOwnerships}
              onLinkOwnership={handleLinkUnlinkedOwnership}
              onWipeOwnership={handleWipeUnlinkedOwnership}
              onIgnore={handleIgnoreUnlinkedOwnership}
            />
          )}

          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">{t("receivingDetails")}</h2>
              <div className="space-y-3">
                <ReceiveMethodNimimo identity={ownership.identity} hasCustomHandle={hasCustomHandle ?? false} />
                {displayAddresses.length > 0 &&
                  displayAddresses.map((address) => {
                    return (
                      <ReceiveMethodBlockchain
                        key={address.chain}
                        address={address}
                        isExpanded={expandedBlockchain === address.chain}
                        onToggle={() =>
                          setExpandedBlockchain(expandedBlockchain === address.chain ? null : address.chain)
                        }
                      />
                    )
                  })}
              </div>
            </div>
          </div>

          <RecoveryCard
            createdAt={ownership.ownershipCreatedAt}
            recoveryState={ownership.recoveryState}
          />
        </div>
      </main>
    </div>
  )
}
