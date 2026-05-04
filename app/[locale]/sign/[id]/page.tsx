"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CroodlesAvatar } from "@/components/croodles-avatar"
import { useOwnership } from "@/components/ownership-provider"

import {
  buildAndSignTransfer,
  broadcastTransaction,
  getLatestBlockhash,
} from "@/lib/wallet/solana-send"
import {
  buildAndSignEthTransfer,
  broadcastEthTransaction,
  getEthTxParams,
} from "@/lib/wallet/ethereum-send"
import {
  buildAndSignBitcoinTransfer,
  broadcastBitcoinTransaction,
} from "@/lib/wallet/bitcoin-send"

// ── Types ──────────────────────────────────────────────────────────────

interface IntentData {
  intent_id: string
  status: string
  from: string | null
  to_handle: string
  to_address: string
  to_avatar: string | null
  chain: string
  asset: string
  amount: string
  memo: string | null
  tx_hash: string | null
  sign_url: string
  expires_at: string
  created_at: string
}

type PageStatus = "loading" | "ready" | "signing" | "broadcasting" | "success" | "error" | "expired" | "not_found" | "already_done"

// ── Constants ──────────────────────────────────────────────────────────

const CHAIN_LOGO: Record<string, string> = {
  bitcoin: "/logos/bitcoin.svg",
  ethereum: "/logos/ethereum.svg",
  solana: "/logos/solana.svg",
}

const CHAIN_NAME: Record<string, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
}

const EXPLORER_URL: Record<string, (hash: string) => string> = {
  bitcoin: (h) => `https://blockstream.info/tx/${h}`,
  ethereum: (h) => `https://etherscan.io/tx/${h}`,
  solana: (h) => `https://explorer.solana.com/tx/${h}`,
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return addr.slice(0, 6) + "\u2026" + addr.slice(-6)
}

// ── Component ──────────────────────────────────────────────────────────

export default function SignIntentPage() {
  const t = useTranslations("signIntent")
  const tCommon = useTranslations("common")
  const params = useParams()
  const intentId = params.id as string
  const { data: session } = useSession()
  const ownership = useOwnership()

  const [intent, setIntent] = useState<IntentData | null>(null)
  const [status, setStatus] = useState<PageStatus>("loading")
  const [error, setError] = useState("")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isRecipient, setIsRecipient] = useState(false)

  // Fetch intent on mount
  const fetchIntent = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/intents/${encodeURIComponent(intentId)}`)
      if (res.status === 404) {
        setStatus("not_found")
        return
      }
      const data = await res.json()
      if (data.error === "not_found") {
        setStatus("not_found")
        return
      }
      setIntent(data)

      if (data.status === "expired") {
        setStatus("expired")
      } else if (data.status === "completed" || data.status === "cancelled" || data.status === "signed") {
        setTxHash(data.tx_hash)
        setStatus("already_done")
      } else if (new Date(data.expires_at) < new Date()) {
        setStatus("expired")
      } else {
        setStatus("ready")
      }
    } catch {
      setError("Failed to load intent")
      setStatus("error")
    }
  }, [intentId])

  useEffect(() => {
    if (intentId) fetchIntent()
  }, [intentId, fetchIntent])

  // Check if the logged-in user is the recipient
  useEffect(() => {
    if (!intent || !ownership.ownershipId || ownership.status !== "ready") return
    fetch(`/api/addresses/by-ownership/${ownership.ownershipId}`)
      .then((r) => r.json())
      .then((data) => {
        const match = data.addresses?.some(
          (a: { address: string }) => a.address.toLowerCase() === intent.to_address.toLowerCase(),
        )
        if (match) setIsRecipient(true)
      })
      .catch(() => {})
  }, [intent, ownership.ownershipId, ownership.status])

  // Sign and broadcast
  async function handleSign() {
    if (!intent || !ownership.ownershipId) return
    setStatus("signing")
    setError("")

    try {
      const mnemonic = await ownership.getMnemonic(ownership.ownershipId)
      const chain = intent.chain
      let txId = ""

      if (chain === "solana") {
        const blockhash = await getLatestBlockhash()
        setStatus("broadcasting")
        const lamports = BigInt(Math.round(parseFloat(intent.amount) * 1e9))
        const { base64 } = await buildAndSignTransfer({
          mnemonic,
          toAddress: intent.to_address,
          lamports,
          recentBlockhash: blockhash,
        })
        txId = await broadcastTransaction(base64, intent.to_address)
      } else if (chain === "ethereum") {
        const res = await fetch(`/api/addresses/by-ownership/${ownership.ownershipId}`)
        const addrs = await res.json()
        const ethAddr = addrs.addresses?.find((a: { chain: string }) => a.chain === "ethereum")?.address
        if (!ethAddr) throw new Error("No Ethereum address found")

        const ethParams = await getEthTxParams(ethAddr)
        setStatus("broadcasting")
        const valueWei = BigInt(Math.round(parseFloat(intent.amount) * 1e18))
        const { signedHex } = await buildAndSignEthTransfer({
          mnemonic,
          toAddress: intent.to_address,
          valueWei,
          ...ethParams,
        })
        txId = await broadcastEthTransaction(signedHex, intent.to_address, ethAddr)
      } else if (chain === "bitcoin") {
        const res = await fetch(`/api/addresses/by-ownership/${ownership.ownershipId}`)
        const addrs = await res.json()
        const btcAddr = addrs.addresses?.find((a: { chain: string }) => a.chain === "bitcoin")?.address
        if (!btcAddr) throw new Error("No Bitcoin address found")

        setStatus("broadcasting")
        const satoshis = BigInt(Math.round(parseFloat(intent.amount) * 1e8))
        const { hex } = await buildAndSignBitcoinTransfer({
          mnemonic,
          toAddress: intent.to_address,
          satoshis,
          fromAddress: btcAddr,
        })
        txId = await broadcastBitcoinTransaction(hex, intent.to_address, btcAddr)
      }

      // Mark intent as completed
      await fetch(`/api/v1/intents/${encodeURIComponent(intentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", tx_hash: txId }),
      })

      setTxHash(txId)
      setStatus("success")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed")
      setStatus("error")
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────

  const timeLeft = intent?.expires_at
    ? Math.max(0, Math.floor((new Date(intent.expires_at).getTime() - Date.now()) / 1000))
    : 0
  const minutesLeft = Math.floor(timeLeft / 60)
  const secondsLeft = timeLeft % 60

  // ── Loading state ──────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────

  if (status === "not_found") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">{t("notFoundTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("notFoundDescription")}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Expired ────────────────────────────────────────────────────────

  if (status === "expired") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">{t("expiredTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("expiredDescription")}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Already completed / cancelled ──────────────────────────────────

  if (status === "already_done" && intent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            {intent.status === "completed" ? (
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            ) : (
              <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            )}
            <h2 className="text-xl font-semibold">
              {intent.status === "completed" ? t("completedTitle") : t("intentStatus", { status: intent.status })}
            </h2>
            {intent.tx_hash && (
              <a
                href={EXPLORER_URL[intent.chain]?.(intent.tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline"
              >
                {t("viewTransaction")} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────────

  if (status === "success" && intent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t("sentTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("sentDescription", { amount: intent.amount, asset: intent.asset, handle: intent.to_handle })}
              </p>
            </div>
            {txHash && (
              <a
                href={EXPLORER_URL[intent.chain]?.(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline"
              >
                {t("viewOnExplorer", { chain: CHAIN_NAME[intent.chain] ?? intent.chain })} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────

  if (status === "error" && !intent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">{t("errorTitle")}</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => { setStatus("loading"); fetchIntent() }}>
              {t("tryAgain")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main signing view ──────────────────────────────────────────────

  if (!intent) return null

  const notLoggedIn = !session?.user
  const noWallet = ownership.status !== "ready"
  const isSigningOrBroadcasting = status === "signing" || status === "broadcasting"

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 pb-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>

          {/* Intent details */}
          <div className="space-y-4">
            {/* Recipient */}
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              {intent.to_avatar ? (
                <Image
                  src={intent.to_avatar}
                  alt={intent.to_handle}
                  width={40}
                  height={40}
                  className="rounded-full object-cover shrink-0"
                  style={{ width: 40, height: 40 }}
                />
              ) : (
                <CroodlesAvatar handle={intent.to_handle.replace("@", "")} size={40} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{intent.to_handle}</p>
                <p className="font-mono text-xs text-muted-foreground truncate">
                  {truncateAddress(intent.to_address)}
                </p>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("amount")}</span>
                <span className="text-lg font-semibold">
                  {intent.amount} {intent.asset}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("network")}</span>
                <div className="flex items-center gap-2">
                  {CHAIN_LOGO[intent.chain] && (
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                      <Image
                        src={CHAIN_LOGO[intent.chain]}
                        alt={intent.chain}
                        width={16}
                        height={16}
                        className="w-4 h-4 object-contain"
                      />
                    </div>
                  )}
                  <span className="text-sm font-medium">
                    {CHAIN_NAME[intent.chain] ?? intent.chain}
                  </span>
                </div>
              </div>

              {intent.memo && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm text-muted-foreground shrink-0">{t("memo")}</span>
                  <span className="text-sm text-right">{intent.memo}</span>
                </div>
              )}

              {intent.from && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("from")}</span>
                  <span className="text-sm">{intent.from}</span>
                </div>
              )}
            </div>

            {/* Expiry countdown */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {t("expiresIn", { time: `${minutesLeft}:${secondsLeft.toString().padStart(2, "0")}` })}
              </span>
            </div>
          </div>

          {/* Confirmation checkbox */}
          {status === "ready" && !notLoggedIn && !noWallet && !isRecipient && (
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                {t.rich("confirmSend", {
                  amount: intent.amount,
                  asset: intent.asset,
                  handle: intent.to_handle,
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </span>
            </label>
          )}

          {/* Error message */}
          {status === "error" && error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            {notLoggedIn ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("signInPrompt")}
                </p>
                <Button asChild className="w-full">
                  <a href="/auth/login">{t("signIn")}</a>
                </Button>
              </div>
            ) : noWallet ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("walletLoading")}
                </p>
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : isRecipient ? (
              <div className="text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {t("recipientWarning")}
                </p>
              </div>
            ) : (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSign}
                  disabled={!confirmed || isSigningOrBroadcasting}
                >
                  {isSigningOrBroadcasting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {status === "signing" ? t("signing") : t("broadcasting")}
                    </span>
                  ) : status === "error" ? (
                    t("retry")
                  ) : (
                    t("sendButton", { amount: intent.amount, asset: intent.asset })
                  )}
                </Button>

                {status === "error" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setStatus("ready"); setError(""); setConfirmed(false) }}
                  >
                    {tCommon("back")}
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
