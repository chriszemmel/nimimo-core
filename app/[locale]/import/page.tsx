"use client"

import { Suspense } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"
import { ImportSeedCard } from "@/app/[locale]/restore/components/import-seed-card"
import { Link } from "@/i18n/navigation"

function ImportContent() {
  const t = useTranslations("restore")
  return (
    <div className="bg-background min-h-[calc(100dvh-3.5rem)] flex items-center justify-center p-4">
      <main className="w-full max-w-2xl space-y-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <ImportSeedCard />
        </div>
        <div className="text-center">
          <Link
            href="/restore"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("restoreFromQrInsteadLink")}
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ImportContent />
    </Suspense>
  )
}
