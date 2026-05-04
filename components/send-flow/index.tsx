"use client"

import { logger } from "@/lib/logger"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { apiFetch } from "@/lib/api-fetch"
import { Loader2, CheckCircle2, XCircle, ExternalLink, Delete, QrCode, Upload, X, ClipboardPaste } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOwnership } from "@/components/ownership-provider"
import {
  SOL_FEE_LAMPORTS,
  getLatestBlockhash,
  buildAndSignTransfer,
  buildAndSignSplTransfer,
  broadcastTransaction,
  checkUsdcRecipientAta,
  detectAddressChain,
  isNimimoHandle,
  USDC_MINT_ADDRESS,
  USDC_DECIMALS,
} from "@/lib/wallet/solana-send"
import { buildAndSignBitcoinTransfer, broadcastBitcoinTransaction } from "@/lib/wallet/bitcoin-send"
import {
  buildAndSignEthTransfer,
  broadcastEthTransaction,
  getEthTxParams,
} from "@/lib/wallet/ethereum-send"
import { CameraQRScanner } from "@/app/[locale]/recovery/components/camera-qr-scanner"
import { readQRFromImage } from "@/lib/recovery/qr-reader"
import { useCurrency } from "@/app/[locale]/wallet/hooks/use-currency"
import { addOptimisticSend } from "@/app/[locale]/wallet/hooks/use-balances"

import {
  FLOW_STEPS,
  KEYPAD_KEYS,
  getRecentRecipients,
  saveRecentRecipient,
  type SendFlowProps,
  type RecipientResult,
  type RecentRecipient,
  type Step,
  type SendStatus,
  type ChainType,
} from "./types"
import {
  CHAIN_FEE_ESTIMATE,
  CHAIN_SYMBOL,
  CHAIN_EXPLORER,
  amountToChainUnits,
  formatChainUnits,
  extractAddressFromQR,
  truncateAddress,
  assetAmountToRawUnits,
  assetFormatRawUnits,
  assetMaxInputDecimals,
  assetDisplayDecimals,
  assetSymbol,
  type Asset,
} from "./chain-utils"
import {
  RecipientAvatar,
  RecipientCard,
  AssetSelector,
  assetsFromAddresses,
  StepHeader,
} from "./ui"

const log = logger("send")

// ── Main component ────────────────────────────────────────────────────────────

export function SendFlow({ open, onOpenChange, ownershipId, balances, prefillHandle, prefillChain }: SendFlowProps) {
  const t = useTranslations("sendFlow")
  const tCommon = useTranslations("common")
  const { getMnemonic } = useOwnership()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currencyMode, formatCurrency, cycleCurrencyMode: _cycleCurrencyMode } = useCurrency()
  // ── Step navigation ──────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("recipient")
  const [slideDir, setSlideDir] = useState<"forward" | "backward">("forward")
  const [stepKey, setStepKey] = useState(0)

  // ── Recipient ────────────────────────────────────────────────────────────
  const [recipientInput, setRecipientInput] = useState("")
  const [recipient, setRecipient] = useState<RecipientResult | null>(null)
  const [selectedChain, setSelectedChain] = useState<ChainType | null>(null)
  // Non-native token within the chain. Undefined = native (SOL / ETH / BTC).
  // Currently only "USDC" on Solana is supported.
  const [selectedToken, setSelectedToken] = useState<string | undefined>(undefined)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState("")
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([])
  const [showQRCamera, setShowQRCamera] = useState(false)

  // ── Amount ───────────────────────────────────────────────────────────────
  const [amountStr, setAmountStr] = useState("")
  const [fiatStr, setFiatStr] = useState("")
  const [isFiatInput, setIsFiatInput] = useState(false)
  const [amountError, setAmountError] = useState("")
  const [recipientIsNew, setRecipientIsNew] = useState<boolean>(false)
  // For USDC sends: whether the recipient's USDC token account already exists.
  // `null` means "unknown" (pre-flight still pending or RPC unavailable).
  // `false` means "first send to this recipient, ~0.002 SOL rent will apply".
  const [recipientAtaExists, setRecipientAtaExists] = useState<boolean | null>(null)

  // ── Send ─────────────────────────────────────────────────────────────────
  const [broadcastChecked, setBroadcastChecked] = useState(true)
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle")
  const [txSignature, setTxSignature] = useState("")
  const [sendError, setSendError] = useState("")
  const [confirmedAmountDisplay, setConfirmedAmountDisplay] = useState("")
  const [confirmedFiatDisplay, setConfirmedFiatDisplay] = useState<string | null>(null)
  const [_copied, _setCopied] = useState(false)
  const [vpStyle, setVpStyle] = useState<React.CSSProperties>({})


  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipLookupRef = useRef(false)
  const recipientInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Post-send balance polling lives in `addOptimisticSend` so the schedule
  // survives the dialog closing and the user navigating to /wallet - see
  // `schedulePostSendPolling` in use-balances.ts.

  // USDC is currently Solana-only. If the user picks a non-Solana chain (or
  // clears the chain entirely) the token must fall back to the native asset.
  useEffect(() => {
    if (selectedChain !== "solana" && selectedToken) {
      setSelectedToken(undefined)
    }
  }, [selectedChain, selectedToken])

  // ── Visual viewport lock (iOS/Android keyboard) ──────────────────────────
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      if (window.innerWidth < 640) {
        setVpStyle({ top: vv.offsetTop, height: vv.height, bottom: "auto" })
      } else {
        setVpStyle({})
      }
    }
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    update()
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
      setVpStyle({})
    }
  }, [open])

  useEffect(() => {
    if (open) setRecentRecipients(getRecentRecipients())
  }, [open])

  useEffect(() => {
    if (open && step === "recipient") {
      const t = setTimeout(() => recipientInputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [open, step])

  useEffect(() => {
    if (open && step === "done") resetFlow()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetFlow() {
    setStep("recipient")
    setStepKey(0)
    setSlideDir("forward")
    setRecipientInput("")
    setRecipient(null)
    setSelectedChain(null)
    setSelectedToken(undefined)
    setLookupLoading(false)
    setLookupError("")
    setAmountStr("")
    setAmountError("")
    setRecipientIsNew(false)
    setRecipientAtaExists(null)
    setBroadcastChecked(true)
    setSendStatus("idle")
    setTxSignature("")
    setSendError("")
    setConfirmedAmountDisplay("")
    setConfirmedFiatDisplay(null)
  }

  function navigate(to: Step, dir: "forward" | "backward") {
    setSlideDir(dir)
    setStepKey((k) => k + 1)
    setStep(to)
  }

  // ── Prefill recipient from profile page ──────────────────────────────────
  const prefillDoneRef = useRef(false)
  useEffect(() => {
    if (!open || !prefillHandle || prefillDoneRef.current) return
    prefillDoneRef.current = true
    skipLookupRef.current = true
    setRecipientInput(`@${prefillHandle}`)
    setLookupLoading(true)
    ;(async () => {
      try {
        const res = await apiFetch(`/api/identity/lookup?handle=${encodeURIComponent(prefillHandle)}`)
        const data = await res.json()
        if (data.found) {
          setRecipient({ input: `@${prefillHandle}`, type: "handle", handle: data.handle, addresses: data.addresses, avatarUrl: data.avatar_url })
          if (prefillChain) {
            setSelectedChain(prefillChain)
            navigate("amount", "forward")
          }
          // If no prefillChain: stay on recipient step so user can pick a chain
        }
      } catch { /* fallback: stay on recipient step */ }
      setLookupLoading(false)
    })()
  }, [open, prefillHandle, prefillChain])

  // Reset prefill tracking when flow closes
  useEffect(() => {
    if (!open) prefillDoneRef.current = false
  }, [open])

  // ── Recipient lookup (debounced) ─────────────────────────────────────────
  useEffect(() => {
    if (skipLookupRef.current) { skipLookupRef.current = false; return }
    const input = recipientInput.trim()
    setLookupError("")
    if (!input) {
      setRecipient(null)
      setSelectedChain(null)
      return
    }

    if (lookupTimer.current) clearTimeout(lookupTimer.current)

    lookupTimer.current = setTimeout(async () => {
      setLookupLoading(true)
      setLookupError("")
      setRecipient(null)
      setSelectedChain(null)

      const chain = detectAddressChain(input)
      if (chain) {
        // Self-send check
        const senderAddr = balances.find((b) => b.chain === chain)?.address
        if (senderAddr && senderAddr.toLowerCase() === input.toLowerCase()) {
          setLookupError("You can't send funds to yourself")
          setLookupLoading(false)
          return
        }

        if (chain === "solana") {
          try {
            const vRes = await apiFetch(`/api/wallet/validate-address?address=${encodeURIComponent(input)}`)
            const vData = await vRes.json()
            if (!vData.valid) {
              setLookupError("Invalid Solana address")
              setLookupLoading(false)
              return
            }
          } catch {
            /* RPC unreachable - accept format-checked address */
          }
        }

        // Check if this address belongs to a registered nimimo user (blocking to avoid UI flash)
        const result: RecipientResult = { input, type: "address", chain, addresses: [{ chain, address: input }] }
        try {
          const byAddrRes = await apiFetch(`/api/identity/by-address?address=${encodeURIComponent(input)}`)
          const byAddrData = await byAddrRes.json()
          if (byAddrData.found) {
            result.nimimoHandle = byAddrData.handle
            result.avatarUrl = byAddrData.avatar_url
          }
        } catch { /* reverse lookup failed - show as plain address */ }
        setRecipient(result)
        setSelectedChain(chain as ChainType)
        setLookupLoading(false)
        return
      }

      if (isNimimoHandle(input)) {
        const handle = (input.startsWith("@") ? input.slice(1) : input).toLowerCase()
        try {
          const res = await apiFetch(`/api/identity/lookup?handle=${encodeURIComponent(handle)}`)
          const data = await res.json()
          if (data.found) {
            // Self-send check across all resolved addresses
            const isSelf = (data.addresses as { chain: string; address: string }[]).some(
              ({ chain: c, address: a }) => {
                const senderAddr = balances.find((b) => b.chain === c)?.address
                return senderAddr && senderAddr.toLowerCase() === a.toLowerCase()
              }
            )
            if (isSelf) {
              setLookupError("You can't send funds to yourself")
              setLookupLoading(false)
              return
            }
            setRecipient({ input, type: "handle", handle: data.handle, addresses: data.addresses, avatarUrl: data.avatar_url })
          } else {
            setLookupError("Handle not found")
          }
        } catch {
          setLookupError("Lookup failed, try again")
        }
      } else {
        setLookupError("Enter a nimimo handle or valid address")
      }

      setLookupLoading(false)
    }, 400)

    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current)
    }
  }, [recipientInput]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Solana: check if recipient account is new (needs rent minimum) ────────
  useEffect(() => {
    if (step !== "amount" || selectedChain !== "solana" || !recipient) {
      setRecipientIsNew(false)
      return
    }
    const addr = recipient.addresses.find((a) => a.chain === "solana")?.address
    if (!addr) { setRecipientIsNew(false); return }
    let cancelled = false
    apiFetch(`/api/wallet/validate-address?address=${encodeURIComponent(addr)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRecipientIsNew(d.isNew === true) })
      .catch(() => { if (!cancelled) setRecipientIsNew(false) })
    return () => { cancelled = true }
  }, [step, selectedChain, recipient])

  // ── USDC: pre-flight check whether recipient's token account exists ───────
  // When it doesn't, the send flow warns that ~0.002 SOL rent will apply
  // (paid by the sender on first send to this recipient).
  useEffect(() => {
    if (step !== "amount" || selectedChain !== "solana" || selectedToken !== "USDC" || !recipient) {
      setRecipientAtaExists(null)
      return
    }
    const addr = recipient.addresses.find((a) => a.chain === "solana")?.address
    if (!addr) { setRecipientAtaExists(null); return }
    let cancelled = false
    checkUsdcRecipientAta(addr)
      .then(({ exists }) => { if (!cancelled) setRecipientAtaExists(exists) })
      .catch(() => { if (!cancelled) setRecipientAtaExists(null) })
    return () => { cancelled = true }
  }, [step, selectedChain, selectedToken, recipient])

  // ── Derived state ────────────────────────────────────────────────────────
  const chain = selectedChain ?? "solana"
  const chainSymbol = CHAIN_SYMBOL[chain] ?? "SOL"
  const asset: Asset = { chain, token: selectedToken }
  const assetSym = assetSymbol(asset)
  const feeUnits = CHAIN_FEE_ESTIMATE[chain] ?? SOL_FEE_LAMPORTS

  const nativeBalance = selectedChain
    ? balances.find((b) => b.chain === selectedChain && !b.token)
    : null
  // Balance for the asset the user is sending (native for SOL/ETH/BTC/ENJ,
  // SPL for USDC). When `selectedToken` is set but the user has no USDC
  // entry, `selectedBalance` is null and the amount step will reject the
  // send.
  const selectedBalance = selectedToken
    ? (selectedChain ? balances.find((b) => b.chain === selectedChain && (b.token ?? undefined) === selectedToken) : null)
    : nativeBalance

  const balanceUnits = selectedBalance
    ? assetAmountToRawUnits(selectedBalance.balance, asset)
    : 0n
  // For native sends we reserve the network fee out of the user's cap. For
  // SPL token sends the fee is paid in the chain's native asset, not the
  // token itself, so the full token balance is spendable.
  const maxSendUnits = selectedToken
    ? balanceUnits
    : balanceUnits > feeUnits ? balanceUnits - feeUnits : 0n

  const recipientChainAddress =
    selectedChain && recipient
      ? recipient.addresses.find((a) => a.chain === selectedChain)?.address ?? null
      : null

  // Can the sender cover the Solana tx fee plus possible ATA rent in SOL?
  // Used to warn before the user lands in a failed broadcast.
  const solBalanceUnits = nativeBalance && nativeBalance.chain === "solana"
    ? amountToChainUnits(nativeBalance.balance, "solana")
    : 0n
  const splGasCovered = selectedToken !== "USDC" || solBalanceUnits >= SOL_FEE_LAMPORTS * 2n

  // ── Fiat conversion ────────────────────────────────────────────────────
  const fiatPerCrypto = (() => {
    if (!selectedBalance) return 0
    // Use unit price directly if available (works even with zero balance)
    const price = currencyMode === "EUR" ? selectedBalance.priceEUR : selectedBalance.priceUSD
    if (price) return price
    // Fallback: derive from balance
    const bal = parseFloat(selectedBalance.balance)
    if (!bal) return 0
    const fiatTotal = currencyMode === "EUR"
      ? (selectedBalance.balanceFiatEUR ?? 0)
      : (selectedBalance.balanceFiatUSD ?? 0)
    return fiatTotal / bal
  })()

  // When in fiat input mode, derive the crypto amount from fiat string
  const effectiveAmountStr = isFiatInput && fiatPerCrypto > 0
    ? (() => {
        const fiat = parseFloat(fiatStr)
        if (!fiat || isNaN(fiat)) return ""
        return (fiat / fiatPerCrypto).toFixed(9).replace(/0+$/, "").replace(/\.$/, "")
      })()
    : amountStr

  const amountUnits = assetAmountToRawUnits(effectiveAmountStr, asset)

  const fiatForAmount = (amount: string): string | null => {
    if (currencyMode === "HIDDEN" || !fiatPerCrypto) return null
    const parsed = parseFloat(amount)
    if (!parsed || isNaN(parsed)) return null
    return formatCurrency(parsed * fiatPerCrypto)
  }

  const currencySymbol = currencyMode === "EUR" ? "EUR" : "USD"

  // Exit fiat input mode if currency becomes HIDDEN
  useEffect(() => {
    if (currencyMode === "HIDDEN" && isFiatInput) {
      setAmountStr(effectiveAmountStr)
      setFiatStr("")
      setIsFiatInput(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to currencyMode changes
  }, [currencyMode])

  const toggleFiatInput = () => {
    if (isFiatInput) {
      // Switching from fiat to crypto - keep the derived crypto amount
      setAmountStr(effectiveAmountStr)
      setFiatStr("")
      setIsFiatInput(false)
    } else if (currencyMode !== "HIDDEN" && fiatPerCrypto > 0) {
      // Switching from crypto to fiat - convert current crypto to fiat
      const crypto = parseFloat(amountStr)
      if (crypto && !isNaN(crypto)) {
        setFiatStr((crypto * fiatPerCrypto).toFixed(2))
      } else {
        setFiatStr("")
      }
      setIsFiatInput(true)
    }
  }

  // ── Amount validation ────────────────────────────────────────────────────
  function validateAmount(val: string): boolean {
    const f = parseFloat(val)
    if (!val || isNaN(f) || f <= 0) {
      setAmountError("Enter an amount")
      return false
    }
    const units = assetAmountToRawUnits(val, asset)
    if (units > maxSendUnits) {
      setAmountError(`Max is ${assetFormatRawUnits(maxSendUnits, asset)} ${assetSym}`)
      return false
    }
    // SPL sends: require enough SOL for the tx fee plus possible ATA rent.
    if (selectedToken === "USDC" && !splGasCovered) {
      setAmountError("You need a little SOL to cover the transaction fee")
      return false
    }
    // Solana native sends: new accounts require a rent-exempt minimum (~0.00089 SOL).
    if (chain === "solana" && !selectedToken && recipientIsNew) {
      const SOL_RENT_MIN = 890880n
      if (units < SOL_RENT_MIN) {
        setAmountError("New account needs min 0.00089 SOL to activate")
        return false
      }
    }
    setAmountError("")
    return true
  }

  // ── Numpad ───────────────────────────────────────────────────────────────
  function numpadPress(key: string) {
    const setter = isFiatInput ? setFiatStr : setAmountStr
    const maxDecimals = isFiatInput ? 2 : assetMaxInputDecimals(asset)
    setter((prev) => {
      if (key === "⌫") return prev.slice(0, -1)
      if (key === "." && prev.includes(".")) return prev
      if (key === "." && prev === "") return "0."
      if (prev === "0" && key !== ".") return key
      const next = prev + key
      const [, dec] = next.split(".")
      if (dec && dec.length > maxDecimals) return prev
      return next
    })
    setAmountError("")
  }

  function setMaxAmount() {
    if (isFiatInput && fiatPerCrypto > 0) {
      const maxCrypto = parseFloat(assetFormatRawUnits(maxSendUnits, asset))
      setFiatStr((maxCrypto * fiatPerCrypto).toFixed(2))
    } else {
      setAmountStr(assetFormatRawUnits(maxSendUnits, asset))
    }
    setAmountError("")
  }

  // ── QR handlers ──────────────────────────────────────────────────────────
  async function handleFileQR(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    try {
      const data = await readQRFromImage(file)
      if (data) {
        setRecipientInput(extractAddressFromQR(data))
      } else {
        setLookupError("No QR code found in the image")
      }
    } catch {
      setLookupError("Failed to read QR code from image")
    }
  }

  // ── Send transaction ─────────────────────────────────────────────────────
  async function handleSend() {
    if (!recipientChainAddress || !broadcastChecked || !selectedChain) return
    setSendStatus("signing")
    setSendError("")
    try {
      const mnemonic = await getMnemonic(ownershipId)

      let txId = ""

      if (selectedChain === "solana" && selectedToken === "USDC") {
        const senderAddr = balances.find((b) => b.chain === "solana" && !b.token)?.address
        const blockhash = await getLatestBlockhash()
        setSendStatus("broadcasting")
        const { base64 } = await buildAndSignSplTransfer({
          mnemonic,
          toAddress: recipientChainAddress,
          mintAddress: USDC_MINT_ADDRESS,
          rawAmount: amountUnits,
          decimals: USDC_DECIMALS,
          recentBlockhash: blockhash,
        })
        txId = await broadcastTransaction(base64, recipientChainAddress, senderAddr)

      } else if (selectedChain === "solana") {
        const senderAddr = balances.find((b) => b.chain === "solana" && !b.token)?.address
        const blockhash = await getLatestBlockhash()
        setSendStatus("broadcasting")
        const { base64 } = await buildAndSignTransfer({
          mnemonic,
          toAddress: recipientChainAddress,
          lamports: amountUnits,
          recentBlockhash: blockhash,
        })
        txId = await broadcastTransaction(base64, recipientChainAddress, senderAddr)

      } else if (selectedChain === "ethereum") {
        const fromAddr = balances.find((b) => b.chain === "ethereum")!.address
        const ethParams = await getEthTxParams(fromAddr)
        setSendStatus("broadcasting")
        const { signedHex } = await buildAndSignEthTransfer({
          mnemonic,
          toAddress: recipientChainAddress,
          valueWei: amountUnits,
          ...ethParams,
        })
        txId = await broadcastEthTransaction(signedHex, recipientChainAddress, fromAddr)

      } else if (selectedChain === "bitcoin") {
        const fromAddr = balances.find((b) => b.chain === "bitcoin")!.address
        setSendStatus("broadcasting")
        const { hex } = await buildAndSignBitcoinTransfer({
          mnemonic,
          toAddress: recipientChainAddress,
          satoshis: amountUnits,
          fromAddress: fromAddr,
        })
        txId = await broadcastBitcoinTransaction(hex, recipientChainAddress, fromAddr)

      }

      setTxSignature(txId)
      // Capture confirmed amounts BEFORE invalidating balances (which updates prices)
      setConfirmedAmountDisplay(`${assetFormatRawUnits(amountUnits, asset)} ${assetSym}`)
      setConfirmedFiatDisplay(fiatForAmount(assetFormatRawUnits(amountUnits, asset)))
      // Optimistic insert: show the tx as pending in the wallet's
      // transaction list right now, without waiting for the next poll.
      // The entry is reconciled (dropped) as soon as the signature
      // appears in a real fetch, at which point the user sees the
      // confirmed row from the RPC (outgoing = red, failed = red with
      // failed flag). BTC sends legitimately stay pending until they
      // confirm on chain, which is exactly what this renders.
      const senderForOpt = balances.find((b) => b.chain === selectedChain && !b.token)?.address ?? ""
      addOptimisticSend(queryClient, ownershipId, {
        signature: txId,
        chain: selectedChain,
        token: selectedToken,
        from: senderForOpt,
        to: recipientChainAddress,
        value: assetFormatRawUnits(amountUnits, asset),
        timestamp: Date.now(),
      })
      setSendStatus("success")
      queryClient.invalidateQueries({ queryKey: ["balances"] })
      if (recipient) saveRecentRecipient(recipient, selectedChain)
      setStep("done")
    } catch (e: unknown) {
      log.error("Send failed", e)
      setSendError(e instanceof Error ? e.message : "Transaction failed")
      setSendStatus("error")
      setStep("done")
    }
  }

  // ── Step 1: Recipient ────────────────────────────────────────────────────
  function StepRecipient() {
    const canContinue =
      !!recipient &&
      !lookupLoading &&
      !lookupError &&
      !!selectedChain &&
      !!recipientChainAddress

    async function handlePaste() {
      try {
        const text = await navigator.clipboard.readText()
        setRecipientInput(text.trim())
      } catch { /* clipboard denied */ }
    }

    // Filter out current ownership from recent recipients
    const filteredRecents = recentRecipients.filter((r) =>
      !r.addresses?.some(({ chain: c, address: a }) => {
        const senderAddr = balances.find((b) => b.chain === c)?.address
        return senderAddr && senderAddr.toLowerCase() === a.toLowerCase()
      })
    )

    function selectRecent(r: RecentRecipient) {
      skipLookupRef.current = true
      setRecipientInput(r.input)
      setRecipient(r)
      if (r.savedChain) setSelectedChain(r.savedChain as ChainType)
      else if (r.type === "address" && r.chain) setSelectedChain(r.chain as ChainType)
    }

    return (
      <>
        <StepHeader title={t("stepRecipientTitle")} stepNumber={1} totalSteps={FLOW_STEPS.length} onClose={() => onOpenChange(false)} />

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 pt-6 pb-4 space-y-4">

            {/* Search input */}
            <div className="relative">
              <Input
                ref={recipientInputRef}
                placeholder="Search username or paste address"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                className="pr-20 h-12 text-base"
                style={{ fontSize: "16px" }}
                inputMode="text"
                enterKeyHint="search"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {recipientInput && (
                  <button
                    type="button"
                    onClick={() => setRecipientInput("")}
                    className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePaste}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  aria-label="Paste"
                >
                  <ClipboardPaste className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* QR scan / upload */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowQRCamera(true)}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                {t("scanQR")}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {t("uploadQR")}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileQR} />

            {/* Lookup feedback */}
            <div className="min-h-[20px]">
              {lookupLoading && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("lookingUp")}
                </span>
              )}
              {lookupError && !lookupLoading && recipientInput.trim() && (
                <span className="text-sm text-destructive">{lookupError}</span>
              )}
            </div>

            {/* Resolved recipient + status */}
            {recipient && !lookupLoading && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {recipient.type === "handle"
                      ? `@${recipient.handle} found`
                      : `Valid ${recipient.chain!.charAt(0).toUpperCase() + recipient.chain!.slice(1)} address`}
                  </span>
                </div>
                <RecipientCard recipient={recipient} selectedChain={selectedChain} />

                {/* Asset picker. Handles show the full matrix (BTC, ETH,
                 *  SOL, USDC). Pasted/scanned addresses already constrain
                 *  the chain; we still show the picker for Solana so the
                 *  user can choose SOL vs USDC. Bitcoin and Ethereum
                 *  addresses skip the picker (one asset per address). */}
                {(() => {
                  const assetOptions = recipient.type === "handle"
                    ? assetsFromAddresses(recipient.addresses)
                    : recipient.chain === "solana"
                      ? assetsFromAddresses(recipient.addresses)
                      : []
                  if (assetOptions.length === 0) return null
                  return (
                    <AssetSelector
                      options={assetOptions}
                      selectedChain={selectedChain}
                      selectedToken={selectedToken}
                      onSelect={(opt) => {
                        setSelectedChain(opt.chain as ChainType)
                        setSelectedToken(opt.token)
                      }}
                    />
                  )
                })()}
              </div>
            )}

            {/* Recent recipients */}
            {!recipientInput && filteredRecents.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("recent")}</p>
                <div className="space-y-0.5">
                  {filteredRecents.map((r) => (
                    <button
                      key={r.input}
                      onClick={() => selectRecent(r)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
                    >
                      <RecipientAvatar recipient={r} size={36} />
                      <div className="min-w-0 flex-1">
                        {r.type === "handle" ? (
                          <>
                            <p className="font-medium text-sm">@{r.handle}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {r.savedChain ?? r.chain ?? ""}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-mono text-sm">{truncateAddress(r.input)}</p>
                            <p className="text-xs text-muted-foreground capitalize">{r.chain}</p>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] border-t border-border/50 bg-background">
          <Button className="w-full h-12 text-base" disabled={!canContinue} onClick={() => navigate("amount", "forward")}>
            {t("continueButton")}
          </Button>
        </div>
      </>
    )
  }

  // ── Step 2: Amount ───────────────────────────────────────────────────────
  function StepAmount() {
    const inputStr = isFiatInput ? fiatStr : amountStr
    const canContinue = !!inputStr && parseFloat(inputStr) > 0 && !amountError && amountUnits > 0n && amountUnits <= maxSendUnits
    const feeDisplay = `~${formatChainUnits(feeUnits, chain)} ${chainSymbol}`

    return (
      <>
        <StepHeader
          title={t("stepAmountTitle")}
          stepNumber={2}
          totalSteps={FLOW_STEPS.length}
          onBack={() => navigate("recipient", "backward")}
          onClose={() => onOpenChange(false)}
        />

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-4 pt-4 pb-2 space-y-4">
              {recipient && <RecipientCard recipient={recipient} selectedChain={selectedChain} />}

              {/* New Solana account warning (native sends only) */}
              {chain === "solana" && !selectedToken && recipientIsNew && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>
                    {t.rich("newAccountMinimum", {
                      // eslint-disable-next-line react/jsx-no-literals
                      amount: () => <strong>0.00089 SOL</strong>,
                    })}
                  </span>
                </div>
              )}

              {/* USDC: disclose the ATA rent cost on first send to this recipient */}
              {selectedToken === "USDC" && recipientAtaExists === false && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                  {t("usdcCreatesAta")}
                </div>
              )}

              {/* USDC: warn if sender doesn't have enough SOL for the fee */}
              {selectedToken === "USDC" && !splGasCovered && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{t("usdcNeedsSolForFee")}</span>
                </div>
              )}

              {/* Amount display */}
              <div className="text-center py-6">
                {isFiatInput ? (
                  <>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className={`font-bold tabular-nums transition-[font-size] duration-150 ${fiatStr.length > 8 ? "text-3xl" : "text-5xl"}`}>
                        {fiatStr || "0"}
                      </span>
                      <span className="text-xl text-muted-foreground font-medium">{currencySymbol}</span>
                    </div>
                    {effectiveAmountStr && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {parseFloat(effectiveAmountStr)
                          .toFixed(assetDisplayDecimals(asset))
                          .replace(/\.?0+$/, "")} {assetSym}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className={`font-bold tabular-nums transition-[font-size] duration-150 ${amountStr.length > 8 ? "text-3xl" : "text-5xl"}`}>
                        {amountStr || "0"}
                      </span>
                      <span className="text-xl text-muted-foreground font-medium">{assetSym}</span>
                    </div>
                    {fiatForAmount(amountStr) && (
                      <p className="text-sm text-muted-foreground mt-1">{fiatForAmount(amountStr)}</p>
                    )}
                  </>
                )}
                {currencyMode !== "HIDDEN" && fiatPerCrypto > 0 && (
                  <button
                    onClick={toggleFiatInput}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={isFiatInput ? `Switch to ${assetSym} input` : `Switch to ${currencySymbol} input`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    {isFiatInput ? assetSym : currencySymbol}
                  </button>
                )}
                {amountError && <p className="text-sm text-destructive mt-2">{amountError}</p>}
              </div>

              {/* Balance info */}
              <div className="bg-secondary/40 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("available")}</span>
                  <span className="tabular-nums font-medium">
                    {selectedBalance ? parseFloat(selectedBalance.balance).toFixed(selectedToken === "USDC" ? 2 : 4) : "0"} {assetSym}
                    {currencyMode !== "HIDDEN" && fiatPerCrypto > 0 && selectedBalance && (
                      <span className="text-xs text-muted-foreground font-normal ml-1.5">({formatCurrency(parseFloat(selectedBalance.balance) * fiatPerCrypto)})</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("estFee")}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {feeDisplay}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1.5">
                  <span className="text-muted-foreground">{t("maxSendable")}</span>
                  <span>
                    <button onClick={setMaxAmount} className="tabular-nums font-semibold text-foreground hover:underline underline-offset-2">
                      {assetFormatRawUnits(maxSendUnits, asset)} {assetSym}
                    </button>
                    {currencyMode !== "HIDDEN" && fiatPerCrypto > 0 && (
                      <span className="text-xs text-muted-foreground font-normal ml-1.5">({formatCurrency(parseFloat(assetFormatRawUnits(maxSendUnits, asset)) * fiatPerCrypto)})</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Numpad + CTA */}
          <div className="shrink-0 border-t border-border/50 bg-background">
            <div className="px-4 pt-3 pb-2">
              <Button
                className="w-full h-12 text-base"
                disabled={!canContinue}
                onClick={() => { if (validateAmount(effectiveAmountStr)) navigate("confirm", "forward") }}
              >
                {t("continueButton")}
              </Button>
            </div>
            <div className="px-4 pb-[max(12px,env(safe-area-inset-bottom))] grid grid-cols-3 gap-1.5">
              {KEYPAD_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => numpadPress(key)}
                  className={`h-14 rounded-xl font-medium transition-all active:scale-95 select-none ${
                    key === "⌫"
                      ? "bg-secondary/60 hover:bg-secondary text-muted-foreground flex items-center justify-center text-xl"
                      : "bg-secondary/40 hover:bg-secondary/80 text-foreground text-xl"
                  }`}
                >
                  {key === "⌫" ? <Delete className="w-5 h-5" /> : key}
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Step 3: Confirm ──────────────────────────────────────────────────────
  function StepConfirm() {
    const sending = sendStatus === "signing" || sendStatus === "broadcasting"
    // Fee is always paid in the chain's native asset, even for SPL sends, so
    // totalUnits only makes sense when sending the native asset. For token
    // sends we show amount and fee as separate line items on different scales.
    const totalUnits = selectedToken ? 0n : amountUnits + feeUnits
    const chainLabel = chain.charAt(0).toUpperCase() + chain.slice(1)
    const assetLabel = selectedToken ? `${chainLabel} (${assetSym})` : chainLabel

    return (
      <>
        <StepHeader
          title={t("stepConfirmTitle")}
          stepNumber={3}
          totalSteps={FLOW_STEPS.length}
          onBack={sending ? undefined : () => navigate("amount", "backward")}
          onClose={() => onOpenChange(false)}
        />

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 pt-5 pb-4 space-y-5">
            {recipient && (
              <div className="flex flex-col items-center gap-3 py-4">
                <RecipientAvatar recipient={recipient} size={64} />
                <div className="text-center">
                  {recipient.type === "handle" ? (
                    <p className="font-semibold text-lg">@{recipient.handle}</p>
                  ) : (
                    <p className="font-mono text-base">{truncateAddress(recipient.input)}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-0.5">{chainLabel}</p>
                </div>
              </div>
            )}

            <div className="text-center">
              <p className="text-4xl font-bold tabular-nums">
                {assetFormatRawUnits(amountUnits, asset)} {assetSym}
              </p>
              {fiatForAmount(assetFormatRawUnits(amountUnits, asset)) && (
                <p className="text-lg text-muted-foreground mt-1">{fiatForAmount(assetFormatRawUnits(amountUnits, asset))}</p>
              )}
            </div>

            <div className="bg-secondary/40 rounded-xl overflow-hidden divide-y divide-border/50 text-sm">
              {recipientChainAddress && (
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{t("address")}</p>
                  <p className="font-mono text-xs break-all">{recipientChainAddress}</p>
                </div>
              )}
              <div className="px-4 py-3 flex justify-between">
                <span className="text-muted-foreground">{t("network")}</span>
                <span className="font-medium">{assetLabel}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-muted-foreground">{t("amount")}</span>
                <span className="tabular-nums font-medium">
                  {assetFormatRawUnits(amountUnits, asset)} {assetSym}
                  {fiatForAmount(assetFormatRawUnits(amountUnits, asset)) && (
                    <span className="text-xs text-muted-foreground font-normal ml-1.5">({fiatForAmount(assetFormatRawUnits(amountUnits, asset))})</span>
                  )}
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-muted-foreground">{t("estFee")}</span>
                <span className="tabular-nums text-muted-foreground">
                  ~{formatChainUnits(feeUnits, chain)} {chainSymbol}
                </span>
              </div>
              {!selectedToken && (
                <div className="px-4 py-3 flex justify-between font-semibold">
                  <span>{t("estTotal")}</span>
                  <span className="tabular-nums">
                    ~{formatChainUnits(totalUnits, chain)} {chainSymbol}
                    {currencyMode !== "HIDDEN" && fiatPerCrypto > 0 && (
                      <span className="text-xs text-muted-foreground font-normal ml-1.5">({formatCurrency(parseFloat(formatChainUnits(totalUnits, chain)) * fiatPerCrypto)})</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastChecked}
                onChange={(e) => setBroadcastChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-foreground cursor-pointer"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                {t.rich("confirmAck", {
                  highlight: (chunks) => (
                    <span className="text-foreground font-medium">{chunks}</span>
                  ),
                })}
              </span>
            </label>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] border-t border-border/50 bg-background">
          <Button className="w-full h-12 text-base gap-2" disabled={!broadcastChecked || sending} onClick={handleSend}>
            {sending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {sendStatus === "signing" ? t("signing") : t("broadcasting")}
              </>
            ) : (
              t("sendButton")
            )}
          </Button>
        </div>
      </>
    )
  }

  // ── Step 4: Done ─────────────────────────────────────────────────────────

  function StepDone() {
    if (sendStatus === "success") {
      const explorerUrl = `${CHAIN_EXPLORER[chain] ?? CHAIN_EXPLORER.solana}${txSignature}`
      const chainLabel = chain.charAt(0).toUpperCase() + chain.slice(1)
      const amountDisplay = confirmedAmountDisplay || `${assetFormatRawUnits(amountUnits, asset)} ${assetSym}`
      const fiatDisplay = confirmedFiatDisplay ?? fiatForAmount(assetFormatRawUnits(amountUnits, asset))
      const recipientLabel = recipient
        ? (recipient.type === "handle" || recipient.nimimoHandle)
          ? `@${recipient.handle ?? recipient.nimimoHandle}`
          : truncateAddress(recipient.input)
        : null

      return (
        <>
          {/* eslint-disable-next-line react/jsx-no-literals */}
          <style>{`
            @keyframes sf-circle-pop {
              0%   { transform: scale(0); }
              55%  { transform: scale(1.18); }
              75%  { transform: scale(0.94); }
              100% { transform: scale(1); }
            }
            @keyframes sf-check-draw {
              to { stroke-dashoffset: 0; }
            }
            @keyframes sf-fade-up {
              from { opacity: 0; transform: translateY(14px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .sf-circle   { animation: sf-circle-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.15s both; }
            .sf-check    { animation: sf-check-draw 0.42s ease-out 0.6s both; }
            .sf-amount   { animation: sf-fade-up 0.4s ease-out 0.85s both; }
            .sf-to       { animation: sf-fade-up 0.4s ease-out 1.0s both; }
            .sf-details  { animation: sf-fade-up 0.4s ease-out 1.15s both; }
            .sf-btn      { animation: sf-fade-up 0.4s ease-out 1.3s both; }
            @keyframes sf-burst { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { opacity: 0; } }
            .sf-burst { position: absolute; pointer-events: none; top: 50%; left: 50%; }
            .sf-burst span { position: absolute; width: 6px; height: 6px; border-radius: 9999px; animation: sf-burst 0.7s cubic-bezier(0.25,0.46,0.45,0.94) 0.55s both; }
            .sf-burst span:nth-child(1)  { background: #10b981; animation-name: sb1; }
            .sf-burst span:nth-child(2)  { background: #3b82f6; animation-name: sb2; }
            .sf-burst span:nth-child(3)  { background: #f59e0b; animation-name: sb3; }
            .sf-burst span:nth-child(4)  { background: #ef4444; animation-name: sb4; }
            .sf-burst span:nth-child(5)  { background: #8b5cf6; animation-name: sb5; }
            .sf-burst span:nth-child(6)  { background: #45e6d1; animation-name: sb6; }
            .sf-burst span:nth-child(7)  { background: #f43f5e; animation-name: sb7; width: 4px; height: 4px; }
            .sf-burst span:nth-child(8)  { background: #a855f7; animation-name: sb8; width: 4px; height: 4px; }
            @keyframes sb1 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-35px,-50px) scale(0); opacity: 0; } }
            @keyframes sb2 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(40px,-40px) scale(0); opacity: 0; } }
            @keyframes sb3 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-50px,15px) scale(0); opacity: 0; } }
            @keyframes sb4 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(45px,25px) scale(0); opacity: 0; } }
            @keyframes sb5 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-20px,-55px) scale(0); opacity: 0; } }
            @keyframes sb6 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(55px,-10px) scale(0); opacity: 0; } }
            @keyframes sb7 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-45px,40px) scale(0); opacity: 0; } }
            @keyframes sb8 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(25px,50px) scale(0); opacity: 0; } }
          `}</style>

          {/* Main content - vertically centered */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            {/* Checkmark + confetti */}
            <div className="relative mb-8">
              <div className="sf-burst"><span /><span /><span /><span /><span /><span /><span /><span /></div>
              <div className="sf-circle w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "rgba(16, 185, 129, 0.12)", boxShadow: "0 0 48px rgba(16, 185, 129, 0.18)" }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path
                    className="sf-check"
                    d="M12 24 L20 32 L36 16"
                    stroke="#10b981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="38"
                    strokeDashoffset="38"
                  />
                </svg>
              </div>
            </div>

            {/* Amount - hero */}
            <div className="sf-amount">
              <p className="text-[2.5rem] font-bold tabular-nums text-green-400 leading-none">
                {amountDisplay}
              </p>
              {fiatDisplay && (
                <p className="text-base text-muted-foreground mt-2">{fiatDisplay}</p>
              )}
            </div>

            {/* Recipient */}
            {recipientLabel && (
              <div className="sf-to flex items-center justify-center gap-1.5 mt-5 text-muted-foreground text-base">
                <span>{t("sentTo")}</span>
                {(recipient?.type === "handle" || recipient?.nimimoHandle) ? (
                  <span className="text-foreground font-medium flex items-center gap-1">
                    {recipientLabel}
                    <RecipientAvatar recipient={recipient!} size={18} />
                  </span>
                ) : (
                  <span className="font-mono text-foreground">{recipientLabel}</span>
                )}
              </div>
            )}

            {/* Explorer link */}
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-details inline-flex items-center gap-1.5 mt-6 text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {t("viewOnExplorer", { chain: chainLabel })}
            </a>
          </div>

          {/* Done button */}
          <div className="sf-btn shrink-0 px-4 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]">
            <Button className="w-full h-12 text-base" onClick={() => { queryClient.invalidateQueries({ queryKey: ["balances"] }); onOpenChange(false); router.push("/wallet") }}>
              {t("doneButton")}
            </Button>
          </div>
        </>
      )
    }

    return (
      <>
        <div className="flex items-center justify-end px-4 h-[68px] shrink-0 border-b border-border/50">
          <button onClick={() => onOpenChange(false)} className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-secondary transition-colors text-muted-foreground" aria-label={t("close")}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 pt-8 pb-4 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-9 h-9 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xl font-semibold">{t("transactionFailed")}</p>
              <p className="text-sm text-muted-foreground mt-1 break-words">{sendError || t("somethingWentWrong")}</p>
            </div>
          </div>
        </div>
        <div className="shrink-0 px-4 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] border-t border-border/50 space-y-2">
          <Button variant="outline" className="w-full h-12 text-base" onClick={() => { navigate("confirm", "backward"); setSendStatus("idle") }}>
            {tCommon("tryAgain")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>{tCommon("cancel")}</Button>
        </div>
      </>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (!open) return null

  const slideClass =
    slideDir === "forward"
      ? "animate-in slide-in-from-right-4 duration-200 ease-out"
      : "animate-in slide-in-from-left-4 duration-200 ease-out"

  return (
    <>
      <div
        aria-hidden="true"
        onClick={() =>
          step === "done" || !["signing", "broadcasting"].includes(sendStatus)
            ? onOpenChange(false)
            : undefined
        }
        className="fixed inset-0 h-[100dvh] z-50 bg-black/0 sm:bg-black/60 sm:flex sm:items-center sm:justify-center"
      />
      <div aria-hidden="true" className="fixed inset-0 h-[100dvh] z-50 bg-background sm:hidden pointer-events-none" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("sendButton")}
        style={vpStyle}
        className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden sm:fixed sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[560px] sm:max-h-[88vh] sm:rounded-2xl sm:shadow-2xl sm:border sm:border-border/50"
      >
        <div key={stepKey} className={`relative flex flex-col flex-1 min-h-0 overflow-hidden ${slideClass}`}>
          {step === "recipient" && StepRecipient()}
          {step === "amount" && StepAmount()}
          {step === "confirm" && StepConfirm()}
          {step === "done" && StepDone()}
        </div>
      </div>

      {/* QR camera - rendered last to stack above the panel */}
      {showQRCamera && (
        <CameraQRScanner
          onScan={(data) => {
            setShowQRCamera(false)
            setRecipientInput(extractAddressFromQR(data))
          }}
          onClose={() => setShowQRCamera(false)}
        />
      )}
    </>
  )
}
