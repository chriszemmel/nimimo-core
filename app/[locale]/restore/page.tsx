"use client"

import { Suspense } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"
import { RestoreCard } from "./components/restore-card"
import { Link } from "@/i18n/navigation"

function RestoreContent() {
  const t = useTranslations("importSeed")
  return (
    <div className="bg-background min-h-[calc(100dvh-3.5rem)] flex items-center justify-center p-4">
      <main className="w-full max-w-2xl space-y-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <RestoreCard />
        </div>
        <div className="text-center">
          <Link
            href="/import"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("importSeedInsteadLink")}
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function RestorePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RestoreContent />
    </Suspense>
  )
}
