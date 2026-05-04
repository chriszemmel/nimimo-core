"use client"

import { logger } from "@/lib/logger"
import type React from "react"

import { useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2, Upload, FileCheck, Eye, EyeOff, Camera, FileUp, X } from "lucide-react"
import { readQRFromImage, readQRFromPDF, parseRecoveryQR } from "@/lib/recovery/qr-reader"
import { decryptRecoveryData } from "@/lib/recovery/crypto"
import { useToast } from "@/hooks/use-toast"
import type { OwnershipRecord } from "@/lib/ownership/indexeddb"
import { useRouter } from "@/i18n/navigation"
import { useIsMobile } from "@/lib/hooks/use-mobile"
import { CameraQRScanner } from "./camera-qr-scanner"

const log = logger("recovery")

interface VerifyRecoveryCardProps {
  ownership: OwnershipRecord
  onVerified: () => void
}

export function VerifyRecoveryCard({ onVerified }: VerifyRecoveryCardProps) {
  const { toast } = useToast()
  const t = useTranslations("recovery.verify")
  const router = useRouter()
  const isMobile = useIsMobile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [verifyPin, setVerifyPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifySuccess, setVerifySuccess] = useState(false)
  const [decryptedMnemonic, setDecryptedMnemonic] = useState<string | null>(null)
  const [showSeedPhrase, setShowSeedPhrase] = useState(false)
  const [showCameraScanner, setShowCameraScanner] = useState(false)
  const [scannedQRData, setScannedQRData] = useState<string | null>(null)

  const hasSource = Boolean(uploadedFile || scannedQRData)

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (isVerifying) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      setUploadedFile(file)
      setScannedQRData(null)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setScannedQRData(null)
      setVerifyError(null)
    }
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setScannedQRData(null)
    setVerifyPin("")
    setVerifyError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCameraScan = (qrData: string) => {
    setScannedQRData(qrData)
    setShowCameraScanner(false)
    setUploadedFile(null)
    setVerifyError(null)
    toast({
      title: t("qrScannedToastTitle"),
      description: t("qrScannedToastBody"),
    })
  }

  const handleVerifyRecovery = async () => {
    if ((!uploadedFile && !scannedQRData) || !verifyPin) {
      toast({
        title: t("missingInfoTitle"),
        description: t("missingInfoBody"),
        variant: "destructive",
      })
      return
    }

    setIsVerifying(true)
    setVerifyError(null)

    try {
      let qrData: string | null = null

      if (scannedQRData) {
        qrData = scannedQRData
      } else if (uploadedFile) {
        // Step 1: Extract QR code from file
        if (uploadedFile.type === "application/pdf") {
          qrData = await readQRFromPDF(uploadedFile)
        } else if (uploadedFile.type.startsWith("image/")) {
          const readTimeout = new Promise<string | null>((resolve) => {
            setTimeout(() => {
              resolve(null)
            }, 35000)
          })

          qrData = await Promise.race([readQRFromImage(uploadedFile), readTimeout])
        } else {
          setVerifyError(t("unsupportedFile"))
          setIsVerifying(false)
          return
        }

        if (!qrData) {
          setVerifyError(t("noQrFound"))
          setIsVerifying(false)
          return
        }
      }

      if (!qrData) {
        setVerifyError(t("noQrData"))
        setIsVerifying(false)
        return
      }

      // Step 2: Parse recovery data
      const recoveryData = parseRecoveryQR(qrData)
      if (!recoveryData) {
        setVerifyError(t("invalidFormat"))
        setIsVerifying(false)
        return
      }

      // Step 3: Attempt to decrypt with provided password
      try {
        const mnemonic = await decryptRecoveryData(
          recoveryData.crypto.data,
          recoveryData.crypto.iv,
          recoveryData.crypto.salt,
          verifyPin,
        )

        setDecryptedMnemonic(mnemonic)
        setVerifySuccess(true)
      } catch {
        setVerifyError(t("wrongPassword"))
        setIsVerifying(false)
        return
      }
    } catch (error) {
      log.error("Verification error", error)
      setVerifyError(t("genericError"))
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDone = async () => {
    await onVerified()
    router.push("/identity")
  }

  return (
    <>
      {showCameraScanner && <CameraQRScanner onScan={handleCameraScan} onClose={() => setShowCameraScanner(false)} />}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-6 w-6" style={{ color: "#3b82f6" }} />
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
          </div>
          <CardDescription className="text-base">
            {verifySuccess
              ? t("descriptionSuccess")
              : hasSource
                ? t("descriptionStep2")
                : t("descriptionStep1")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verifySuccess ? (
            <>
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-5 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <p className="text-base font-medium text-green-900 dark:text-green-100">{t("successHeading")}</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">{t("successWarning")}</p>
              </div>

              {decryptedMnemonic && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{t("seedPhraseLabel")}</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                    className="gap-2 flex-shrink-0"
                  >
                    {showSeedPhrase ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        {t("seedPhraseHide")}
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        {t("seedPhraseShow")}
                      </>
                    )}
                  </Button>
                </div>
              )}
              {showSeedPhrase && decryptedMnemonic && (
                <>
                  <p className="text-xs text-red-600 dark:text-red-400">{t("seedPhraseWarning")}</p>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm break-words">{decryptedMnemonic}</div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Hidden native file input - controlled via the big drop-zone label below. */}
              <input
                ref={fileInputRef}
                id="upload"
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileUpload}
                disabled={isVerifying}
                className="sr-only"
              />

              {!hasSource && (
                <div className="space-y-3">
                  <label
                    htmlFor="upload"
                    className="group flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 px-4 cursor-pointer transition-colors hover:bg-accent/5"
                    style={{
                      borderColor: isDragOver ? "rgba(59, 130, 246, 0.9)" : "rgba(59, 130, 246, 0.5)",
                      backgroundColor: isDragOver ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.03)",
                    }}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                    onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true) }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <div className="rounded-full bg-blue-500/10 p-3 group-hover:bg-blue-500/15 transition-colors">
                      <FileUp className="h-7 w-7 text-blue-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-foreground">{t("chooseFileTitle")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("chooseFileHint")}</p>
                    </div>
                  </label>

                  {isMobile && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">{t("or")}</span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full h-12 bg-transparent border-2 gap-2"
                        style={{ borderColor: "rgba(59, 130, 246, 0.5)" }}
                        onClick={() => setShowCameraScanner(true)}
                        disabled={isVerifying}
                      >
                        <Camera className="h-5 w-5 text-blue-500" />
                        <span className="text-base font-semibold">{t("scanWithCamera")}</span>
                      </Button>
                    </>
                  )}
                </div>
              )}

              {hasSource && (
                <>
                  <div
                    className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                  >
                    <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100 truncate">
                        {uploadedFile ? uploadedFile.name : t("scannedPlaceholder")}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">{t("readyToVerify")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      disabled={isVerifying}
                      className="p-1 text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 transition-colors disabled:opacity-50"
                      aria-label={t("removeFileAria")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 pt-1">
                    <Label htmlFor="verify-password">{t("passwordLabel")}</Label>
                    <div className="relative">
                      <Input
                        id="verify-password"
                        name="nimimo-recovery-verify"
                        type={showPin ? "text" : "password"}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                        placeholder={t("passwordPlaceholder")}
                        value={verifyPin}
                        onChange={(e) => setVerifyPin(e.target.value)}
                        disabled={isVerifying}
                        inputMode="text"
                        className="font-mono pr-10"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPin ? t("hidePasswordAria") : t("showPasswordAria")}
                        aria-pressed={showPin}
                        tabIndex={-1}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {verifyError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{verifyError}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter>
          {verifySuccess ? (
            <Button onClick={handleDone} className="w-full" style={{ backgroundColor: "#3b82f6" }}>
              {t("doneButton")}
            </Button>
          ) : (
            hasSource && (
              <Button
                onClick={handleVerifyRecovery}
                disabled={isVerifying || !verifyPin}
                className="w-full"
                style={{
                  backgroundColor: verifyPin && !isVerifying ? "#3b82f6" : undefined,
                }}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("verifyingButton")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t("verifyButton")}
                  </>
                )}
              </Button>
            )
          )}
        </CardFooter>
      </Card>
    </>
  )
}
