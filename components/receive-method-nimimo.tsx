"use client"

import { useState } from "react"
import { Copy, Share2, Check, Info, ArrowUpCircle } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ReceiveMethodNimimoProps {
  identity: string
  hasCustomHandle?: boolean
}

export function ReceiveMethodNimimo({ identity, hasCustomHandle }: ReceiveMethodNimimoProps) {
  const t = useTranslations("receiveMethodNimimo")
  const [copied, setCopied] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const handle = `@${identity}`
  const fullUrl = `https://nimimo.com/@${identity}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: t("shareText", { url: fullUrl }),
        })
      } catch {
        // User cancelled or error
      }
    }
  }

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              <Image src="/logos/nimimo.ico" alt="nimimo" width={24} height={24} className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground text-sm">nimimo</span>
                <button
                  onClick={() => setInfoOpen(true)}
                  className="p-0.5 hover:bg-secondary rounded transition-colors"
                  aria-label={t("aboutButtonAria")}
                >
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              <span className="font-mono text-sm text-muted-foreground truncate">{handle}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="p-2 hover:bg-secondary rounded transition-colors" aria-label={t("copyLinkAria")}>
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {"share" in navigator && (
              <button onClick={handleShare} className="p-2 hover:bg-secondary rounded transition-colors" aria-label={t("shareProfileAria")}>
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">{t("yourHandleHeading")}</p>
              <p>
                {t.rich("yourHandleBody", {
                  // Self-closing tag - the handle value is injected by the
                  // tag function itself, so next-intl never has to mix a
                  // `{handle}` variable with the `<handle>` tag name.
                  handle: () => <span className="font-mono text-foreground">{handle}</span>,
                })}
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">{t("supportedChainsHeading")}</p>
              <p>{t("supportedChainsBody")}</p>
            </div>

            {!hasCustomHandle && (
              <div>
                <p className="font-medium text-foreground mb-1">{t("upgradeHeading")}</p>
                <p>
                  {t.rich("upgradeBody", {
                    handle: (chunks) => <span className="font-mono text-foreground">{chunks}</span>,
                  })}
                </p>
                <Link
                  href="/settings/handle"
                  className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  onClick={() => setInfoOpen(false)}
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  {t("upgradeCta")}
                </Link>
              </div>
            )}

            <div>
              <p className="font-medium text-foreground mb-1">{t("resolutionHeading")}</p>
              <p>{t("resolutionBody")}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
