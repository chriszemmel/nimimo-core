"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useInAppBrowser } from "@/lib/hooks/use-in-app-browser"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export function InAppBrowserWarning() {
  const t = useTranslations("inAppBrowser")
  const { isInAppBrowser, browser, appName, instructions } = useInAppBrowser()
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isInAppBrowser || dismissed) return null

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AlertDialog open={true} onOpenChange={() => {}}>
      <AlertDialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {browser === "generic-webview"
                  ? t("bodyGeneric")
                  : t("bodyNamed", { appName: appName ?? "" })}
              </p>
              {instructions && (
                <div className="rounded-md bg-muted p-3 text-sm text-foreground">
                  <p className="font-medium mb-1">{t("instructionsHeading")}</p>
                  <p>{instructions}</p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleCopyUrl} variant="outline" className="w-full">
            {copied ? t("copied") : t("copyLink")}
          </Button>
          <AlertDialogAction
            onClick={() => setDismissed(true)}
            className="w-full bg-transparent border border-border text-muted-foreground hover:bg-muted text-xs"
          >
            {t("continueAnyway")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
