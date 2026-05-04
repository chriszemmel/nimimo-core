"use client"

import { logger } from "@/lib/logger"
import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

const log = logger("app")

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("errors")
  const tCommon = useTranslations("common")

  useEffect(() => {
    log.error("Unhandled error", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-xl font-semibold">{t("genericTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("genericBody")}
        </p>
        <Button onClick={reset} variant="outline">
          {tCommon("tryAgain")}
        </Button>
      </div>
    </div>
  )
}
