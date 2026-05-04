"use client"

import { logger } from "@/lib/logger"
import { useState, useRef } from "react"
import { NavigationGuard } from "@/lib/hooks/use-navigation-guard"
import { useLocale, useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2, Download, AlertCircle, ChevronDown, Eye, EyeOff } from "lucide-react"
import { encryptRecoveryData } from "@/lib/recovery/crypto"
import { generateRecoveryPDF, type RecoveryPDFStrings } from "@/lib/recovery/pdf"
import { downloadBlob } from "@/lib/recovery/download"
import { decryptSeed } from "@/lib/ownership/crypto"
import { generateRecoveryQR } from "@/lib/recovery/qr"
import { useToast } from "@/hooks/use-toast"
import type { OwnershipRecord } from "@/lib/ownership/indexeddb"

const log = logger("recovery")

interface CreateRecoveryCardProps {
  ownership: OwnershipRecord
  identity: string
  onRecoveryCreated: () => void
}

export function CreateRecoveryCard({ ownership, identity, onRecoveryCreated }: CreateRecoveryCardProps) {
  const { toast } = useToast()
  const t = useTranslations("recovery.create")
  const tPdf = useTranslations("recovery.pdf")
  const locale = useLocale()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [recoveryData, setRecoveryData] = useState<{
    encryptedData: string
    iv: string
    salt: string
  } | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const [warningExpanded, setWarningExpanded] = useState(false)

  // Guard: QR generated but PDF not yet downloaded
  const guardActive = qrDataUrl !== null && !hasDownloaded

  const MIN_LENGTH = 8
  const isValidInput =
    password.length >= MIN_LENGTH && confirmPassword.length >= MIN_LENGTH && password === confirmPassword
  // Surface *why* the Create button is disabled once the user has started
  // typing, so they aren't left staring at a greyed-out button. The message
  // stays hidden on a pristine form to avoid up-front noise.
  const validationMessage: string | null =
    password.length > 0 || confirmPassword.length > 0
      ? password.length < MIN_LENGTH
        ? t("validationTooShort", { min: MIN_LENGTH })
        : confirmPassword.length > 0 && password !== confirmPassword
          ? t("validationMismatch")
          : null
      : null

  const handleCreateRecovery = async () => {
    if (password.length < MIN_LENGTH) {
      toast({
        title: t("invalidInputTitle"),
        description: t("invalidInputTooShort", { min: MIN_LENGTH }),
        variant: "destructive",
      })
      return
    }
    if (password !== confirmPassword) {
      toast({
        title: t("invalidInputTitle"),
        description: t("invalidInputMismatch"),
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)

    // Stage tracker so we can report exactly which step failed.
    // The recovery flow chains four sub-operations and any of them can fail
    // independently on browsers with weak/buggy WebCrypto or Canvas implementations
    // (notably older Samsung Internet on legacy Galaxy devices).
    type Stage = "decrypt" | "encrypt" | "generate-qr" | "render-qr"
    let stage: Stage = "decrypt"

    try {
      stage = "decrypt"
      const mnemonic = await decryptSeed(ownership.encryptedSeed, ownership.iv, ownership.ownership_id)

      stage = "encrypt"
      const encrypted = await encryptRecoveryData(mnemonic, password)
      setRecoveryData(encrypted)

      const qrData = JSON.stringify({
        v: 1,
        type: "recovery",
        oid: ownership.ownership_id,
        crypto: {
          algo: "aes-gcm",
          kdf: "pbkdf2",
          data: encrypted.encryptedData,
          iv: encrypted.iv,
          salt: encrypted.salt,
        },
      })

      stage = "generate-qr"
      const canvas = await generateRecoveryQR({
        data: qrData,
        logo: "/logo.png",
        displaySize: 320,
      })

      stage = "render-qr"
      if (qrCanvasRef.current) {
        const ctx = qrCanvasRef.current.getContext("2d")
        qrCanvasRef.current.width = canvas.width
        qrCanvasRef.current.height = canvas.height
        ctx?.drawImage(canvas, 0, 0)
      }
      // toDataURL throws SecurityError if the canvas is tainted by a cross-origin image.
      const dataUrl = canvas.toDataURL()
      setQrDataUrl(dataUrl)
    } catch (error) {
      // Reset partial state so the user can retry cleanly.
      setRecoveryData(null)

      const isSecurityError = error instanceof DOMException && error.name === "SecurityError"
      const errorName = error instanceof Error ? error.name : "UnknownError"

      // Stage-specific user messaging. Never leak crypto material; the logger
      // already strips sensitive context keys.
      let title: string
      let description: string
      switch (stage) {
        case "decrypt":
          title = t("stageErrors.decryptTitle")
          description = t("stageErrors.decryptDescription")
          break
        case "encrypt":
          title = t("stageErrors.encryptTitle")
          description = t("stageErrors.encryptDescription")
          break
        case "generate-qr":
          title = t("stageErrors.generateQrTitle")
          description = isSecurityError
            ? t("stageErrors.generateQrSecurityDescription")
            : t("stageErrors.generateQrDescription")
          break
        case "render-qr":
          title = t("stageErrors.renderQrTitle")
          description = isSecurityError
            ? t("stageErrors.renderQrSecurityDescription")
            : t("stageErrors.renderQrDescription")
          break
      }

      log.error("Recovery creation failed", error, { stage, errorName })
      toast({ title, description, variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!recoveryData || !qrCanvasRef.current) return

    try {
      // Resolve all PDF strings client-side and pass them to the
      // generator. We can't call `useTranslations` inside the jsPDF
      // module itself (it's not a React tree), so the component owns
      // the translator and the generator stays a pure function.
      const pdfStrings: RecoveryPDFStrings = {
        title: tPdf("title"),
        identityLine: tPdf("identityLine", { handle: identity }),
        createdLine: tPdf("createdLine", {
          date: new Date().toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        }),
        securedWith: tPdf("securedWithPassword"),
        credentialLabel: tPdf("yourPassword"),
        cutLineHint: tPdf("cutLineHint"),
        instructionsHeading: tPdf("instructionsHeading"),
        instructions: [
          tPdf("instruction1"),
          tPdf("instruction2"),
          tPdf("instruction3Password"),
          tPdf("instruction4"),
        ],
        page2Title: tPdf("page2Title"),
        technicalInformation: tPdf("technicalInformation"),
        labelOwnershipId: tPdf("labelOwnershipId"),
        labelMethod: tPdf("labelMethod"),
        labelSalt: tPdf("labelSalt"),
        labelIv: tPdf("labelIv"),
        labelEncryptedData: tPdf("labelEncryptedData"),
        securityNoticeHeading: tPdf("securityNoticeHeading"),
        securityNotices: [
          tPdf("securityNotice1"),
          tPdf("securityNotice2Password"),
          tPdf("securityNotice3"),
          tPdf("securityNotice4"),
          tPdf("securityNotice5"),
        ],
        footer: tPdf("footer"),
      }

      const pdfBlob = await generateRecoveryPDF({
        ownership_id: ownership.ownership_id,
        identity: identity,
        encryptedData: recoveryData.encryptedData,
        iv: recoveryData.iv,
        salt: recoveryData.salt,
        createdAt: Date.now(),
        qrCanvas: qrCanvasRef.current,
        securityMethod: "password",
        securityCredential: password,
        strings: pdfStrings,
      })

      // downloadBlob routes iOS through the share sheet (so "Save to
      // Files" is the prominent option) and desktop/Android through a
      // plain anchor download. See lib/recovery/download.ts.
      await downloadBlob(pdfBlob, `nimimo-recovery-${identity}.pdf`)

      setHasDownloaded(true)

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }, 100)
    } catch (error) {
      // User dismissed the iOS share sheet - not a real error.
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      log.error("Error in PDF download process", error)
      toast({
        title: t("downloadErrorTitle"),
        description: t("downloadErrorDescription"),
        variant: "destructive",
      })
    }
  }

  const handleVerify = async () => {
    // Update DB state to "created" before navigating to verify
    await onRecoveryCreated()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <>
    <NavigationGuard active={guardActive} />
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-6 w-6" style={{ color: "#3b82f6" }} />
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
        </div>
        <CardDescription className="text-base">
          {qrDataUrl ? t("descriptionReady") : t("descriptionInitial")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!qrDataUrl ? (
          <>
            <div className="space-y-2 pt-2">
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="nimimo-recovery-secret"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder", { min: MIN_LENGTH })}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  className="font-mono pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t("hidePasswordAria") : t("showPasswordAria")}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("confirmPasswordLabel")}</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  name="nimimo-recovery-secret-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("confirmPasswordPlaceholder")}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  className="font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t("hidePasswordAria") : t("showPasswordAria")}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="bg-card/50 rounded-lg pt-2">
              <p className="text-sm text-muted-foreground text-center mb-2">{t("qrLabel")}</p>
              {qrDataUrl && (
                <img
                  src={qrDataUrl || "/placeholder.svg"}
                  alt="Recovery QR"
                  className="w-full max-w-56 mx-auto object-contain"
                />
              )}
            </div>
            {/* Collapsible to keep the Verify Recovery button in view on
                small phones. The body pushed the CTA off-screen before. */}
            <button
              type="button"
              onClick={() => setWarningExpanded((v) => !v)}
              aria-expanded={warningExpanded}
              className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-left transition-colors hover:bg-amber-100/60 dark:hover:bg-amber-950/30"
            >
              <div className="flex gap-2 items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{t("keepSafeTitle")}</p>
                    <ChevronDown
                      className={`h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 transition-transform ${
                        warningExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  {warningExpanded && (
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{t("keepSafeBody")}</p>
                  )}
                </div>
              </div>
            </button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {!qrDataUrl ? (
          <>
            {validationMessage && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center w-full" role="status">
                {validationMessage}
              </p>
            )}
            <Button
              onClick={handleCreateRecovery}
              disabled={isGenerating || !isValidInput}
              className="w-full"
              style={{
                backgroundColor: isValidInput && !isGenerating ? "#3b82f6" : undefined,
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("creatingButton")}
                </>
              ) : (
                t("createButton")
              )}
            </Button>
          </>
        ) : (
          <>
            {/* Never lock the Download button after a click: the user may
                have dismissed the iOS share sheet, cancelled the Android
                download notification, or simply lost the file between
                downloading and verifying. They have to be able to retry
                without getting stuck in a "Downloaded" state they can't
                undo. After the first click the button steps down to an
                outline variant so Verify Recovery becomes the prominent
                CTA and the two buttons don't fight for attention. */}
            <Button
              onClick={handleDownloadPDF}
              variant={hasDownloaded ? "outline" : "default"}
              className="w-full gap-2"
              style={{ backgroundColor: hasDownloaded ? undefined : "#3b82f6" }}
            >
              <Download className="h-4 w-4" />
              {hasDownloaded ? t("downloadAgainButton") : t("downloadButton")}
            </Button>
            <Button
              onClick={handleVerify}
              disabled={!hasDownloaded}
              variant={hasDownloaded ? "default" : "outline"}
              className="w-full"
              style={{
                backgroundColor: hasDownloaded ? "#3b82f6" : undefined,
                opacity: hasDownloaded ? 1 : undefined,
              }}
            >
              {t("verifyButton")}
            </Button>
          </>
        )}
      </CardFooter>
      <canvas ref={qrCanvasRef} style={{ display: "none" }} />
    </Card>
    </>
  )
}
