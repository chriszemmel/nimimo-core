"use client"

import { logger } from "@/lib/logger"
import type React from "react"
import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Footer } from "@/components/footer"
import { Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { InAppBrowserWarning } from "@/components/in-app-browser-warning"

const log = logger("auth")

/**
 * Detect whether the page is running inside an installed PWA / home
 * screen shortcut rather than a regular browser tab. When true the
 * login page hides the email magic-link form entirely and shows only
 * Google sign-in, because tapping a magic link in an email app always
 * opens the default browser - never the PWA - so the session cookie
 * lands in the wrong browsing context and the installed app stays
 * signed out. Google OAuth stays inside the PWA's own browsing
 * context and works fine.
 */
function useStandaloneDisplayMode(): boolean {
  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mm = window.matchMedia("(display-mode: standalone)")
    // iOS Safari exposes a vendor-specific `standalone` flag on navigator
    // instead of honoring the standard display-mode media query.
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsStandalone(mm.matches || iosStandalone)
    const listener = (e: MediaQueryListEvent) => setIsStandalone(e.matches || iosStandalone)
    mm.addEventListener("change", listener)
    return () => mm.removeEventListener("change", listener)
  }, [])
  return isStandalone
}

export default function LoginPage() {
  const t = useTranslations("auth.login")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { data: session, status } = useSession()
  const router = useRouter()
  const isStandalone = useStandaloneDisplayMode()

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/identity")
    }
  }, [status, session, router])

  if (status === "loading") {
    return null
  }

  if (status === "authenticated") {
    return null
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await signIn("email", { email, redirect: false })
      setEmailSent(true)
    } catch (error) {
      log.error("Sign in failed", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: "/identity" })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <InAppBrowserWarning />
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 shadow-sm">
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                {emailSent ? t("checkEmailTitle") : t("title")}
              </h1>
            </div>

            {emailSent ? (
              <div className="py-6 text-center space-y-4" aria-live="polite">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-accent" />
                </div>
                <p className="text-muted-foreground">
                  {t("magicLinkSent")} <strong className="text-foreground">{email}</strong>
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEmailSent(false)
                    setEmail("")
                  }}
                  className="text-sm"
                >
                  {t("useDifferentEmail")}
                </Button>
              </div>
            ) : isStandalone ? (
              /* Installed PWA / home-screen shortcut: show only Google
                 sign-in. Email magic links don't work in this browsing
                 context (tapping the link in an email app opens the
                 default browser, not the PWA), so we simply don't offer
                 the option - no form, no divider, no warnings. Clean
                 single-CTA interface, then the recovery / seed-phrase
                 escape hatches below. */
              <div className="space-y-6">
                <Button
                  type="button"
                  className="w-full h-12 text-white text-base font-semibold"
                  style={{ backgroundColor: "#3b82f6" }}
                  onClick={() => handleOAuthSignIn("google")}
                  aria-label={t("continueWithGoogle")}
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {t("continueWithGoogle")}
                </Button>

                <div className="text-center pt-2 space-y-1">
                  <Link
                    href="/restore"
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("haveRecoveryFile")}
                  </Link>
                  <Link
                    href="/import"
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("haveSeedPhrase")}
                  </Link>
                </div>
              </div>
            ) : (
              /* Regular browser tab: full menu. Email primary, Google
                 secondary, recovery/import links at the bottom. Same as
                 it's always been - magic links work fine in a browser,
                 so nothing to hide. */
              <div className="space-y-6">
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      {t("emailLabel")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 bg-accent hover:bg-accent/90 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? t("sendingMagicLink") : t("continueWithEmail")}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-card px-4 text-muted-foreground">{t("orContinueWith")}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 hover:bg-secondary bg-transparent"
                    onClick={() => handleOAuthSignIn("google")}
                    aria-label={t("continueWithGoogle")}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t("continueWithGoogle")}
                  </Button>

                  <div className="text-center pt-4 space-y-1">
                    <Link
                      href="/restore"
                      className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t("haveRecoveryFile")}
                    </Link>
                    <Link
                      href="/import"
                      className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t("haveSeedPhrase")}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
