"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"

interface RecoveryCardProps {
  createdAt: number
  recoveryState: "none" | "created" | "verified"
}

export function RecoveryCard({
  createdAt,
  recoveryState,
}: RecoveryCardProps) {
  const t = useTranslations("identity.recoveryCard")
  const locale = useLocale()
  const [isExpanded, setIsExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Format the creation date in the active locale so a German user
  // sees "5. Apr. 2026" instead of "Apr 5, 2026".
  const createdDate = new Date(createdAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  let statusBadge = {
    label: t("statusNone"),
    className:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  }

  if (recoveryState === "created") {
    statusBadge = {
      label: t("statusCreated"),
      className:
        "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    }
  } else if (recoveryState === "verified") {
    statusBadge = {
      label: t("statusVerified"),
      className:
        "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
    }
  }

  let actionButtons: { label: string; onClick: () => void; variant?: "default" | "outline" }[] = []

  if (recoveryState === "none") {
    actionButtons = [
      {
        label: t("createRecovery"),
        onClick: () => {
          router.push("/recovery?flow=create")
        },
      },
    ]
  } else if (recoveryState === "created") {
    actionButtons = [
      {
        label: t("verifyRecovery"),
        onClick: () => {
          router.push("/recovery?flow=verify")
        },
      },
      {
        label: t("recreate"),
        variant: "outline",
        onClick: () => {
          router.push("/recovery?flow=create")
        },
      },
    ]
  } else if (recoveryState === "verified") {
    actionButtons = [
      {
        label: t("rotateRecovery"),
        onClick: () => {
          router.push("/recovery?flow=rotate")
        },
      },
      {
        label: t("verifyAgain"),
        variant: "outline",
        onClick: () => {
          router.push("/recovery?flow=verify")
        },
      },
    ]
  }

  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    if (isExpanded) {
      timers.push(
        setTimeout(() => {
          cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        }, 100),
      )
    } else {
      // Jump to top. Fire multiple times to beat any in-flight smooth
      // scroll from the previous expand and any collapse-induced reflow.
      const scrollTop = () => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      }
      scrollTop()
      requestAnimationFrame(scrollTop)
      timers.push(setTimeout(scrollTop, 50))
      timers.push(setTimeout(scrollTop, 200))
    }
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [isExpanded])

  return (
    <Card ref={cardRef} className="p-4 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={t("toggleAria")}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        {/* Two-row label/value block. CSS grid with an `auto` first
            column auto-sizes to the widest label across both rows -
            keeps the badge and the created-date aligned without a
            hardcoded label width, so translations like Spanish
            "Recuperación" (longer than English "Recovery") no longer
            spill into the status pill on the right. */}
        <div className="flex-1 min-w-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 items-center">
          <span className="text-sm text-muted-foreground">{t("label")}</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border justify-self-start ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
          <span className="text-sm text-muted-foreground">{t("createdLabel")}</span>
          <span className="text-sm text-foreground">{createdDate}</span>
        </div>
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <p className="text-sm text-muted-foreground">
            {recoveryState === "none" && t("descriptionNone")}
            {recoveryState === "created" && t("descriptionCreated")}
            {recoveryState === "verified" && t("descriptionVerified")}
          </p>
          {recoveryState === "verified" && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t("descriptionVerifiedWarning")}
            </p>
          )}

          <div className="space-y-2">
            {actionButtons.map((button, index) => (
              <Button
                key={index}
                onClick={button.onClick}
                variant={button.variant || "default"}
                size="sm"
                className="w-full"
              >
                {button.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
