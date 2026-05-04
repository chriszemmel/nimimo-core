"use client"

import { logger } from "@/lib/logger"
import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { KeyRound, CheckCircle2, Loader2, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useOwnership } from "@/components/ownership-provider"
import { useSession } from "next-auth/react"
import type { OwnershipRecord } from "@/lib/ownership/indexeddb"
import { BIP39_WORDLIST } from "@/lib/ownership/bip39-wordlist"

const log = logger("import-seed")

type ImportStep = "input" | "success"

export function ImportSeedCard() {
  const t = useTranslations("importSeed")
  const { toast } = useToast()
  const { data: session } = useSession()
  const { getManager } = useOwnership()

  const [step, setStep] = useState<ImportStep>("input")
  const [mnemonic, setMnemonic] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const words = mnemonic.trim().split(/\s+/).filter(Boolean)
  const wordCount = mnemonic.trim() ? words.length : 0

  // Get the word currently being typed (last word if not followed by a space)
  const currentFragment = useMemo(() => {
    if (!mnemonic || mnemonic.endsWith(" ")) return ""
    const parts = mnemonic.trim().split(/\s+/)
    return parts[parts.length - 1].toLowerCase()
  }, [mnemonic])

  // Suggest matching BIP-39 words for the current fragment
  const suggestions = useMemo(() => {
    if (!currentFragment || currentFragment.length < 2) return []
    return BIP39_WORDLIST.filter((w) => w.startsWith(currentFragment)).slice(0, 5)
  }, [currentFragment])

  const handleSuggestionClick = (word: string) => {
    const parts = mnemonic.trim().split(/\s+/)
    parts[parts.length - 1] = word
    setMnemonic(parts.join(" ") + " ")
    setError(null)
  }

  const handleImport = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, " ")

      const bip39 = await import("bip39")
      if (!bip39.validateMnemonic(normalized)) {
        setError(t("invalidMnemonic"))
        setIsProcessing(false)
        return
      }

      // Derive ETH address to check for duplicate seed
      const { HDNodeWallet } = await import("ethers")
      const ethAddress = HDNodeWallet.fromPhrase(normalized, "", "m/44'/60'/0'/0/0").address

      // Check locally: compare against seeds already on this device
      const manager = await getManager()
      await manager.initialize()
      const localOwnerships = await manager.db.getAllOwnerships()
      for (const existing of localOwnerships) {
        try {
          const existingMnemonic = await manager.getMnemonic(existing.ownership_id)
          const existingAddress = HDNodeWallet.fromPhrase(existingMnemonic, "", "m/44'/60'/0'/0/0").address
          if (existingAddress.toLowerCase() === ethAddress.toLowerCase()) {
            setError(t("alreadyImportedLocal"))
            setIsProcessing(false)
            return
          }
        } catch {
          // Skip ownerships that can't be decrypted
        }
      }

      // Check server: see if addresses are already registered under a handle
      const { apiFetch } = await import("@/lib/api-fetch")
      const lookupRes = await apiFetch(`/api/identity/by-address?address=${ethAddress}`)
      if (lookupRes.ok) {
        const { found, handle } = await lookupRes.json()
        if (found) {
          setError(t("alreadyRegistered", { handle }))
          setIsProcessing(false)
          return
        }
      }

      const { generateOwnershipId, encryptSeed } = await import("@/lib/ownership/crypto")
      const ownershipId = generateOwnershipId()
      const { encryptedSeed, iv } = await encryptSeed(normalized, ownershipId)

      const ownership: OwnershipRecord = {
        ownership_id: ownershipId,
        encryptedSeed,
        iv,
        crypto: { version: "v2", kdf: "device-bound" },
        createdAt: Date.now(),
        recovery: {
          state: "none",
          method: null,
          lastCreatedAt: null,
          lastVerifiedAt: null,
        },
        protection: "device",
        version: "v2",
      }

      await manager.db.saveOwnership(ownership)

      // Assign identity immediately if user is authenticated
      if (session?.user?.email) {
        try {
          await manager.assignIdentity(ownershipId)
        } catch (error) {
          log.error("Failed to assign identity during import (will retry on bind)", error)
        }
      }

      // Clear mnemonic from state immediately
      setMnemonic("")
      setStep("success")
    } catch (err) {
      log.error("Seed import failed", err)
      toast({
        title: t("importFailedTitle"),
        description: t("importFailedBody"),
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-3 mb-2">
          <KeyRound className="h-6 w-6" style={{ color: "#3b82f6" }} />
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
        </div>
        <CardDescription className="text-base">
          {t("description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === "input" && (
          <>
            <button
              type="button"
              onClick={() => setShowDisclaimer(!showDisclaimer)}
              className="flex items-center gap-2 w-full text-left text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{t("readBeforeImporting")}</span>
              {showDisclaimer ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </button>

            {showDisclaimer && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 space-y-2">
                <p>
                  {t.rich("disclaimerIntro", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>{t("disclaimerReason1")}</li>
                  <li>{t("disclaimerReason2")}</li>
                  <li>{t("disclaimerReason3")}</li>
                </ul>
                <p>
                  {t.rich("disclaimerOutro", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="seed-input" className="text-base font-medium">
                {t("seedPhraseLabel")}
              </Label>
              <textarea
                id="seed-input"
                value={mnemonic}
                onChange={(e) => { setMnemonic(e.target.value); setError(null) }}
                placeholder={t("seedPhrasePlaceholder")}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                disabled={isProcessing}
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-base font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />

              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => handleSuggestionClick(word)}
                      className="px-3 py-1.5 text-sm font-mono rounded-md bg-muted hover:bg-accent transition-colors"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              )}

              {wordCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {wordCount === 1 ? t("wordCountOne", { count: wordCount }) : t("wordCountMany", { count: wordCount })}
                  {wordCount !== 12 && wordCount !== 24 && t("wordCountExpected")}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{t("compatibilityNote")}</span>
            </div>
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
        {step === "input" && (
          <Button
            onClick={handleImport}
            disabled={isProcessing || wordCount < 12}
            className="w-full"
            style={{ backgroundColor: wordCount >= 12 ? "#3b82f6" : undefined }}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("importing")}
              </>
            ) : (
              t("importButton")
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
  )
}
