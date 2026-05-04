"use client"

import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"

/**
 * Drop-in navigation guard for critical flows.
 *
 * When `active` is true:
 * - Browser back button is intercepted via a pushState guard entry.
 *   Instead of navigating away, a custom in-app dialog appears.
 * - Tab close / refresh triggers the native beforeunload prompt.
 *
 * Renders via a portal to document.body so the overlay is never
 * clipped by parent overflow or transforms.
 *
 * Usage:
 *   <NavigationGuard active={qrDataUrl !== null && !hasDownloaded} />
 */
export function NavigationGuard({ active }: { active: boolean }) {
  const t = useTranslations("common")
  const [blocked, setBlocked] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const handleStay = useCallback(() => {
    setBlocked(false)
    window.history.pushState({ navigationGuard: true }, "")
  }, [])

  const handleLeave = useCallback(() => {
    setBlocked(false)
    window.history.back()
  }, [])

  useEffect(() => {
    if (!active) return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)

    window.history.pushState({ navigationGuard: true }, "")

    const onPopState = () => {
      setBlocked(true)
    }
    window.addEventListener("popstate", onPopState)

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("popstate", onPopState)
    }
  }, [active])

  if (!blocked || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleStay}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t("leavePageTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("leavePageBody")}</p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleStay}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("stay")}
          </button>
          <button
            onClick={handleLeave}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t("leave")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
