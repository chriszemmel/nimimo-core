"use client"

import { logger } from "@/lib/logger"
import type React from "react"

import { useState, useRef } from "react"
import { NavigationGuard } from "@/lib/hooks/use-navigation-guard"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, AlertCircle, CheckCircle2, Loader2, FileUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { readQRFromImage, readQRFromPDF, parseRecoveryQR } from "@/lib/recovery/qr-reader"
import { decryptRecoveryData } from "@/lib/recovery/crypto"
import { useOwnership } from "@/components/ownership-provider"
import type { OwnershipRecord, AccessBinding } from "@/lib/ownership/indexeddb"
import { CameraQRScanner } from "@/app/[locale]/recovery/components/camera-qr-scanner"
import { useIsMobile } from "@/lib/hooks/use-mobile"

import { useSession } from "next-auth/react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const log = logger("restore")

type RestoreStep = "upload" | "decrypt" | "exists" | "bind" | "success"

export function RestoreCard() {
  const t = useTranslations("restore")
  const { toast } = useToast()
  const { data: session } = useSession()
  const { getManager } = useOwnership()
  const isMobile = useIsMobile()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<RestoreStep>("upload")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Guard: active during decrypt/exists/bind steps where data is in flight
  const guardActive = step !== "upload" && step !== "success"
  const [showCameraScanner, setShowCameraScanner] = useState(false)
  const [recoveryData, setRecoveryData] = useState<{
    ownership_id: string
    encryptedData: string
    iv: string
    salt: string
  } | null>(null)
  const [pin, setPin] = useState("")
  const [decryptedMnemonic, setDecryptedMnemonic] = useState<string | null>(null)
  const [existingOwnership, setExistingOwnership] = useState<OwnershipRecord | null>(null)
  const [existingIdentity, setExistingIdentity] = useState<string | null>(null)
  const [availableAccesses, _setAvailableAccesses] = useState<AccessBinding[]>([])
  const [selectedAccessId, setSelectedAccessId] = useState<string | null>(null)
  const [showPayload, _setShowPayload] = useState(false)
  const [decryptError, setDecryptError] = useState<string | null>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    await processFile(file)
  }

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    if (isProcessing) return

    const file = event.dataTransfer.files?.[0]
    if (!file) return

    await processFile(file)
  }

  const handleCameraScan = async (qrData: string) => {
    setShowCameraScanner(false)
    await processQRData(qrData)
  }

  const processFile = async (file: File) => {
    setIsProcessing(true)
    try {
      let qrData: string | null = null

      if (file.type === "application/pdf") {
        qrData = await readQRFromPDF(file)
      } else if (file.type.startsWith("image/")) {
        qrData = await readQRFromImage(file)
      } else {
        toast({
          title: t("invalidFileTypeTitle"),
          description: t("invalidFileTypeBody"),
          variant: "destructive",
        })
        return
      }

      if (!qrData) {
        toast({
          title: t("qrNotFoundTitle"),
          description: t("qrNotFoundBody"),
          variant: "destructive",
        })
        return
      }

      await processQRData(qrData)
    } catch (error) {
      log.error("Error processing file", error)
      toast({
        title: t("processingFailedTitle"),
        description: t("processingFailedBody"),
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const processQRData = async (qrData: string) => {
    const parsed = parseRecoveryQR(qrData)
    if (!parsed) {
      toast({
        title: t("invalidQrTitle"),
        description: t("invalidQrBody"),
        variant: "destructive",
      })
      return
    }

    setRecoveryData({
      ownership_id: parsed.ownership_id,
      encryptedData: parsed.crypto.data,
      iv: parsed.crypto.iv,
      salt: parsed.crypto.salt,
    })

    const manager = await getManager()
    const ownership = await manager.db.getOwnership(parsed.ownership_id)

    if (ownership) {
      let identity: string | null = null
      if (session?.user?.email) {
        identity = await manager.getIdentity(parsed.ownership_id)
      }
      setExistingOwnership(ownership)
      setExistingIdentity(identity)
      setStep("exists")
    } else {
      setStep("decrypt")
    }
  }

  const handleDecrypt = async () => {
    if (!recoveryData || !pin) return

    setIsProcessing(true)
    setDecryptError(null)
    try {
      const { decryptRecoveryData } = await import("@/lib/recovery/crypto")
      const mnemonic = await decryptRecoveryData(recoveryData.encryptedData, recoveryData.iv, recoveryData.salt, pin)

      setDecryptedMnemonic(mnemonic)

      const manager = await getManager()
      await manager.initialize()
      const existing = await manager.db.getOwnership(recoveryData.ownership_id)

      if (existing) {
        setExistingOwnership(existing)
        if (session?.user?.email) {
          try {
            const { apiFetch } = await import("@/lib/api-fetch")
            const response = await apiFetch(`/api/identity/by-ownership/${recoveryData.ownership_id}`)
            if (response.ok) {
              const data = await response.json()
              setExistingIdentity(data.handle || null)
            }
          } catch (error) {
            log.error("Failed to fetch identity", error)
          }
        }
        setStep("exists")
      } else {
        await handleDirectRestore(mnemonic)
      }
    } catch (error) {
      log.error("Decryption error", error)
      setDecryptError(t("incorrectPin"))
      toast({
        title: t("decryptionFailedTitle"),
        description: t("decryptionFailedBody"),
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDirectRestore = async (mnemonic: string) => {
    if (!recoveryData) return

    setIsProcessing(true)
    try {
      const manager = await getManager()
      await manager.initialize()

      const { encryptSeed } = await import("@/lib/ownership/crypto")
      const { encryptedSeed, iv } = await encryptSeed(mnemonic, recoveryData.ownership_id)

      const ownership: OwnershipRecord = {
        ownership_id: recoveryData.ownership_id,
        encryptedSeed,
        iv,
        crypto: {
          version: "v2",
          kdf: "device-bound",
        },
        createdAt: Date.now(),
        recovery: {
          state: "verified",
          method: "pin",
          lastCreatedAt: Date.now(),
          lastVerifiedAt: Date.now(),
        },
        protection: "recovery",
        version: "v2",
      }

      await manager.db.saveOwnership(ownership)

      // Bind ownership to current user and assign identity if authenticated
      if (session?.user?.email) {
        try {
          await manager.bindExistingOwnership(session.user.email, recoveryData.ownership_id)
          await manager.assignIdentity(recoveryData.ownership_id)
        } catch (error) {
          log.error("Failed to bind/assign identity after restore", error)
        }
      }

      setStep("success")
    } catch (error) {
      log.error("Restore error", error)
      toast({
        title: t("restoreFailedTitle"),
        description: t("restoreFailedBody"),
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRestore = async () => {
    if (!recoveryData || !decryptedMnemonic) return

    setIsProcessing(true)
    try {
      const manager = await getManager()
      await manager.initialize()

      const { encryptSeed } = await import("@/lib/ownership/crypto")
      const { encryptedSeed, iv } = await encryptSeed(decryptedMnemonic, recoveryData.ownership_id)

      const ownership: OwnershipRecord = {
        ownership_id: recoveryData.ownership_id,
        encryptedSeed,
        iv,
        crypto: {
          version: "v2",
          kdf: "device-bound",
        },
        createdAt: existingOwnership?.createdAt || Date.now(),
        recovery: {
          state: "verified",
          method: "pin",
          lastCreatedAt: Date.now(),
          lastVerifiedAt: Date.now(),
        },
        protection: "recovery",
        version: "v2",
      }

      await manager.db.saveOwnership(ownership)

      if (selectedAccessId && session?.user?.email) {
        await manager.bindExistingOwnership(selectedAccessId, recoveryData.ownership_id)
      }

      // Always bind ownership to current user and assign identity if authenticated
      if (session?.user?.email) {
        try {
          await manager.bindExistingOwnership(session.user.email, recoveryData.ownership_id)
          await manager.assignIdentity(recoveryData.ownership_id)
        } catch (error) {
          log.error("Failed to bind/assign identity after restore", error)
        }
      }

      setStep("success")
    } catch (error) {
      log.error("Error restoring ownership", error)
      toast({
        title: t("restoreFailedTitle"),
        description: t("restoreFailedBody"),
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOverwrite = async () => {
    if (!recoveryData || !pin) return

    setIsProcessing(true)
    setDecryptError(null)
    try {
      const mnemonic = await decryptRecoveryData(recoveryData.encryptedData, recoveryData.iv, recoveryData.salt, pin)

      const words = mnemonic.trim().split(/\s+/)
      if (words.length !== 24) {
        setDecryptError(t("invalidOrCorrupted"))
        toast({
          title: t("decryptionFailedTitle"),
          description: t("invalidOrCorrupted"),
          variant: "destructive",
        })
        return
      }

      const manager = await getManager()
      await manager.initialize()

      // Atomically remove this ownership from all access bindings
      await manager.db.removeOwnershipFromAllBindings(recoveryData.ownership_id)

      const { encryptSeed } = await import("@/lib/ownership/crypto")
      const { encryptedSeed, iv } = await encryptSeed(mnemonic, recoveryData.ownership_id)

      const ownership: OwnershipRecord = {
        ownership_id: recoveryData.ownership_id,
        encryptedSeed,
        iv,
        crypto: {
          version: "v2",
          kdf: "device-bound",
        },
        createdAt: existingOwnership?.createdAt || Date.now(),
        recovery: {
          state: "verified",
          method: "pin",
          lastCreatedAt: Date.now(),
          lastVerifiedAt: Date.now(),
        },
        protection: "recovery",
        version: "v2",
      }

      await manager.db.saveOwnership(ownership)

      // Bind ownership to current user and assign identity if authenticated
      if (session?.user?.email) {
        try {
          await manager.bindExistingOwnership(session.user.email, recoveryData.ownership_id)
          await manager.assignIdentity(recoveryData.ownership_id)
        } catch (error) {
          log.error("Failed to bind/assign identity after overwrite", error)
        }
      }

      setStep("success")
    } catch (error) {
      log.error("Error overwriting ownership", error)
      setDecryptError(t("incorrectPin"))
      toast({
        title: t("restoreFailedTitle"),
        description: t("restoreFailedBody"),
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <NavigationGuard active={guardActive} />
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-6 w-6" style={{ color: "#3b82f6" }} />
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
          </div>
          <CardDescription className="text-base">
            {t("description")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "upload" && (
            <>
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileUpload}
                className="sr-only"
                disabled={isProcessing}
              />

              <div className="space-y-3">
                <label
                  htmlFor="file-upload"
                  className={`group flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 px-4 transition-colors ${
                    isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent/5"
                  }`}
                  style={{
                    borderColor: isDragOver ? "rgba(59, 130, 246, 0.9)" : "rgba(59, 130, 246, 0.5)",
                    backgroundColor: isDragOver ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.03)",
                  }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  {isProcessing ? (
                    <Loader2 className="h-7 w-7 text-blue-500 animate-spin" />
                  ) : (
                    <>
                      <div className="rounded-full bg-blue-500/10 p-3 group-hover:bg-blue-500/15 transition-colors">
                        <FileUp className="h-7 w-7 text-blue-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-foreground">{t("chooseFileTitle")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("chooseFileHint")}</p>
                      </div>
                    </>
                  )}
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
                      disabled={isProcessing}
                    >
                      <Camera className="h-5 w-5 text-blue-500" />
                      <span className="text-base font-semibold">{t("scanWithCamera")}</span>
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {step === "exists" && existingOwnership && (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{t("ownershipExistsTitle")}</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {existingIdentity
                        ? t("ownershipExistsBodyWithIdentity", { identity: existingIdentity })
                        : t("ownershipExistsBody")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin-exists">{t("enterPinToContinue")}</Label>
                <Input
                  id="pin-exists"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder={t("pinPlaceholder")}
                  className="font-mono"
                />
              </div>

              {decryptError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{decryptError}</p>
                </div>
              )}

              {showPayload && recoveryData && (
                <div className="bg-muted rounded-lg p-4">
                  <pre className="text-xs mt-2 overflow-auto">
                    {JSON.stringify(
                      {
                        ownership_id: recoveryData.ownership_id,
                        identity: existingIdentity,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
            </>
          )}

          {step === "decrypt" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pin">{t("enterPin")}</Label>
                <Input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder={t("pinPlaceholder")}
                  className="font-mono"
                />
              </div>

              {decryptError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{decryptError}</p>
                </div>
              )}
            </>
          )}

          {step === "bind" && (
            <>
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">{t("decryptionSuccessfulTitle")}</p>
                    <p className="text-sm text-green-800 dark:text-green-200">{t("decryptionSuccessfulBody")}</p>
                  </div>
                </div>
              </div>

              {availableAccesses.length > 0 && (
                <div className="space-y-3 pt-2">
                  <Label className="text-base font-medium">{t("linkToAccess")}</Label>
                  <RadioGroup
                    value={selectedAccessId || "none"}
                    onValueChange={(value) => setSelectedAccessId(value === "none" ? null : value)}
                  >
                    <div
                      className="flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors hover:bg-accent/5"
                      style={{
                        borderColor: selectedAccessId === null ? "rgba(59, 130, 246, 0.4)" : "var(--border)",
                        backgroundColor: selectedAccessId === null ? "rgba(59, 130, 246, 0.03)" : "transparent",
                      }}
                    >
                      <RadioGroupItem value="none" id="none" />
                      <Label htmlFor="none" className="font-normal cursor-pointer flex-1">
                        {t("dontLink")}
                      </Label>
                    </div>
                    {availableAccesses.map((access) => (
                      <div
                        key={access.access_id}
                        className="flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors hover:bg-accent/5"
                        style={{
                          borderColor:
                            selectedAccessId === access.access_id ? "rgba(59, 130, 246, 0.4)" : "var(--border)",
                          backgroundColor:
                            selectedAccessId === access.access_id ? "rgba(59, 130, 246, 0.03)" : "transparent",
                        }}
                      >
                        <RadioGroupItem value={access.access_id} id={access.access_id} />
                        <Label htmlFor={access.access_id} className="font-normal cursor-pointer flex-1">
                          {access.access_id}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </>
          )}

          {step === "success" && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">{t("successTitle")}</p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {session?.user?.email ? t("successBodyAuth") : t("successBodyNoAuth")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {step === "upload" && (
            <p className="text-sm text-muted-foreground text-center w-full">
              {t("uploadHint")}
            </p>
          )}

          {step === "decrypt" && (
            <Button
              onClick={handleDecrypt}
              disabled={isProcessing || !pin}
              className="w-full"
              style={{
                backgroundColor: pin ? "#3b82f6" : undefined,
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("decrypting")}
                </>
              ) : (
                t("decryptButton")
              )}
            </Button>
          )}

          {step === "exists" && (
            <div className="flex gap-2 w-full">
              <Button
                onClick={handleRestore}
                disabled={isProcessing || !pin}
                className="flex-1 bg-transparent"
                variant="outline"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("restoring")}
                  </>
                ) : (
                  t("keepAndLink")
                )}
              </Button>
              <Button
                onClick={handleOverwrite}
                disabled={isProcessing || !pin}
                className="flex-1"
                style={{
                  backgroundColor: pin ? "#3b82f6" : undefined,
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("overwriting")}
                  </>
                ) : (
                  t("overwrite")
                )}
              </Button>
            </div>
          )}

          {step === "bind" && (
            <Button
              onClick={handleRestore}
              disabled={isProcessing}
              className="w-full"
              style={{
                backgroundColor: "#3b82f6",
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("restoring")}
                </>
              ) : (
                t("completeRestore")
              )}
            </Button>
          )}

          {step === "success" && (
            <Button
              onClick={() => {
                const dest = session?.user?.email ? "/identity" : "/auth/login"
                window.location.href = dest
              }}
              className="w-full"
              style={{ backgroundColor: "#3b82f6" }}
            >
              {session?.user?.email ? t("continueToIdentity") : t("logIn")}
            </Button>
          )}
        </CardFooter>
      </Card>

      {showCameraScanner && <CameraQRScanner onScan={handleCameraScan} onClose={() => setShowCameraScanner(false)} />}
    </>
  )
}
