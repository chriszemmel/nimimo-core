"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2, XCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { InAppBrowserWarning } from "@/components/in-app-browser-warning"

type VerificationState = "verifying" | "success" | "error" | "already-used"

export default function VerifyPage() {
  const t = useTranslations("auth.verify")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: _session, status } = useSession()
  const [verificationState, setVerificationState] = useState<VerificationState>("verifying")
  const [error, setError] = useState<string | null>(null)
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false)
  const [authResolved, setAuthResolved] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumTimeElapsed(true)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const errorParam = searchParams?.get("error")

    // Check for errors from NextAuth
    if (errorParam) {
      setAuthResolved(true)

      if (minimumTimeElapsed) {
        if (errorParam === "Verification" || errorParam.includes("token")) {
          setVerificationState("already-used")
          setError(t("errorUsedOrExpired"))
        } else {
          setVerificationState("error")
          setError(errorParam)
        }
      }
      return
    }

    // Check authentication status
    if (status === "authenticated") {
      setAuthResolved(true)

      if (minimumTimeElapsed) {
        setVerificationState("success")

        // Redirect after showing success message
        const timer = setTimeout(() => {
          router.push("/identity")
        }, 1200)

        return () => clearTimeout(timer)
      }
    } else if (status === "unauthenticated") {
      // If not authenticated after a delay, show error
      const timer = setTimeout(() => {
        setAuthResolved(true)

        if (minimumTimeElapsed) {
          setVerificationState("error")
          setError(t("errorUnable"))
        }
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [status, searchParams, router, minimumTimeElapsed, t])

  useEffect(() => {
    if (minimumTimeElapsed && authResolved) {
      const errorParam = searchParams?.get("error")

      if (errorParam) {
        if (errorParam === "Verification" || errorParam.includes("token")) {
          setVerificationState("already-used")
          setError(t("errorUsedOrExpired"))
        } else {
          setVerificationState("error")
          setError(errorParam)
        }
      } else if (status === "authenticated") {
        setVerificationState("success")

        const timer = setTimeout(() => {
          router.push("/identity")
        }, 1200)

        return () => clearTimeout(timer)
      }
    }
  }, [minimumTimeElapsed, authResolved, status, searchParams, router, t])

  const renderContent = () => {
    switch (verificationState) {
      case "verifying":
        return (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl" />
              <div className="relative rounded-full bg-accent/10 p-4">
                <Loader2 className="h-10 w-10 animate-spin text-accent" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("verifyingTitle")}</h1>
              <p className="text-sm text-muted-foreground whitespace-nowrap">{t("verifyingBody")}</p>
            </div>
          </>
        )

      case "success":
        return (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
              <div className="relative rounded-full bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("successTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("successBody")}</p>
            </div>
          </>
        )

      case "already-used":
        return (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl" />
              <div className="relative rounded-full bg-amber-500/10 p-4">
                <AlertCircle className="h-10 w-10 text-amber-500" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("alreadyUsedTitle")}</h1>
              <p className="text-sm text-muted-foreground">
                {status === "authenticated" ? t("alreadyLoggedIn") : t("linkExpired")}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {status === "authenticated" ? (
                <Button onClick={() => router.push("/identity")} size="default" className="w-full">
                  {t("goToIdentity")}
                </Button>
              ) : (
                <Button onClick={() => router.push("/auth/login")} size="default" className="w-full">
                  {t("requestNewLink")}
                </Button>
              )}
            </div>
          </>
        )

      case "error":
        return (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl" />
              <div className="relative rounded-full bg-red-500/10 p-4">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("failedTitle")}</h1>
              <p className="text-sm text-muted-foreground">{error || t("failedDefault")}</p>
            </div>
            {status !== "authenticated" && (
              <Button onClick={() => router.push("/auth/login")} size="default" className="w-full">
                {t("backToLogin")}
              </Button>
            )}
          </>
        )
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background overflow-hidden z-40">
      <InAppBrowserWarning />
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-6">{renderContent()}</div>
      </div>
    </div>
  )
}
