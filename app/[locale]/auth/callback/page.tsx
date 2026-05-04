"use client"

import { logger } from "@/lib/logger"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useOwnership } from "@/components/ownership-provider"
import { InAppBrowserWarning } from "@/components/in-app-browser-warning"

const log = logger("auth")

export default function CallbackPage() {
  const t = useTranslations("auth.callback")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [_isSuccess, setIsSuccess] = useState(false)
  const [mountTime] = useState(() => Date.now())
  const [canRedirect, setCanRedirect] = useState(false)
  const { data: session, status } = useSession()
  const { getManager } = useOwnership()
  const [showImportPrompt, setShowImportPrompt] = useState(false)
  const [isCheckingUser, setIsCheckingUser] = useState(false)

  useEffect(() => {
    const minDisplayTime = 2000 // 2 seconds minimum
    const elapsed = Date.now() - mountTime
    const remaining = Math.max(0, minDisplayTime - elapsed)

    const timer = setTimeout(() => {
      setCanRedirect(true)
    }, remaining)

    return () => clearTimeout(timer)
  }, [mountTime])

  useEffect(() => {
    async function checkReturningUser() {
      if (status !== "authenticated" || !session?.user?.email || !canRedirect) return

      setIsCheckingUser(true)
      try {
        // Check if user exists in database (uses session email server-side)
        const response = await fetch("/api/user/check-returning")
        const data = await response.json()

        if (data.isReturning) {
          // Check if ownership exists on device
          const manager = await getManager()
          const binding = await manager.db.getAccessBinding(session.user.email)

          if (!binding || binding.ownership_ids.length === 0) {
            // Returning user with no ownership on device - show import prompt
            setShowImportPrompt(true)
            return
          }
        }

        // Either new user or returning user with ownership - proceed normally
        setIsSuccess(true)
        const redirectTimer = setTimeout(() => {
          const callbackUrl = searchParams?.get("callbackUrl") || "/identity"
          router.push(callbackUrl)
        }, 1500)

        return () => clearTimeout(redirectTimer)
      } catch (_error) {
        log.error("Error checking returning user", _error)
        // On error, proceed normally
        setIsSuccess(true)
        const redirectTimer = setTimeout(() => {
          const callbackUrl = searchParams?.get("callbackUrl") || "/identity"
          router.push(callbackUrl)
        }, 1500)

        return () => clearTimeout(redirectTimer)
      } finally {
        setIsCheckingUser(false)
      }
    }

    checkReturningUser()
  }, [status, canRedirect, router, searchParams, session, getManager])

  const handleImportChoice = () => {
    router.push("/restore")
  }

  const handleNewChoice = () => {
    const callbackUrl = searchParams?.get("callbackUrl") || "/identity"
    router.push(callbackUrl)
  }

  if (!canRedirect || status === "loading" || status === "unauthenticated" || isCheckingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <InAppBrowserWarning />
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardContent className="flex flex-col items-center gap-6 p-8 md:p-12">
            <div className="relative">
              <div className="rounded-full bg-primary/10 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            </div>

            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{t("verifyingTitle")}</h1>
              <p className="text-sm text-muted-foreground md:text-base">{t("verifyingBody")}</p>
            </div>

            <div className="w-full space-y-2">
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all duration-1000 ease-out" style={{ width: "60%" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showImportPrompt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <InAppBrowserWarning />
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardContent className="flex flex-col items-center gap-6 p-8 md:p-12">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{t("welcomeBackTitle")}</h1>
              <p className="text-sm text-muted-foreground md:text-base">
                {t("importPromptBody")}
              </p>
            </div>

            <div className="w-full flex flex-col gap-3">
              <Button onClick={handleImportChoice} className="w-full">
                {t("importExisting")}
              </Button>
              <Button onClick={handleNewChoice} variant="outline" className="w-full bg-transparent">
                {t("createNew")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <InAppBrowserWarning />
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardContent className="flex flex-col items-center gap-6 p-8 md:p-12">
          <div className="relative">
            <div className="rounded-full bg-green-500/10 p-6">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{t("welcomeBackTitle")}</h1>
            <p className="text-sm text-muted-foreground md:text-base">{t("successBody")}</p>
          </div>

          <div className="w-full space-y-2">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: "100%" }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
