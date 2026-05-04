"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { WalletSkeleton } from "./components/wallet-skeleton"
import { useOwnership } from "@/components/ownership-provider"
import type { Balance } from "@/lib/wallet/types"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Send, RefreshCw, ChevronDown, ExternalLink, AlertTriangle } from "lucide-react"
import { SendFlow } from "@/components/send-flow"
import { formatRelativeTime } from "@/lib/wallet/utils"
import { CroodlesAvatar } from "@/components/croodles-avatar"
import type { Transaction } from "@/lib/wallet/types"
import { useBalances } from "./hooks/use-balances"
import { useTransactionHandles } from "./hooks/use-transaction-handles"
import { useCurrency } from "./hooks/use-currency"
export default function WalletPage() {
  const t = useTranslations("wallet")
  const { data: session, status } = useSession()
  const ownership = useOwnership()
  const ownershipId = ownership.ownershipId
  const contentReady = ownership.status === "ready"

  const { balances, isLoadingBalances, isReloading, reloadDisabled, handleReload } = useBalances(ownershipId)
  const { addressHandles } = useTransactionHandles(balances)
  const { currencyMode, cycleCurrencyMode, getFiatValue, formatCurrency } = useCurrency()

  const [showSendDialog, setShowSendDialog] = useState(false)
  // A single chain can expose multiple balances (Solana → SOL + USDC), so
  // the expansion key has to be composite. `assetKey` returns a stable
  // identifier per balance entry.
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null)
  const [showAllTransactions, setShowAllTransactions] = useState<Record<string, boolean>>({})

  const assetKey = (balance: Balance) => `${balance.chain}:${balance.token ?? "native"}`

  // Per-chain set of tx signatures that appear in a token's history.
  // Used to suppress the native "fee leg" row from the main activity list
  // when a tx is already shown on its token row. Every SPL transfer, for
  // example, debits a few lamports of SOL as the tx fee and would
  // otherwise appear twice: once on the USDC row (the real amount) and
  // once on the SOL row as -0.000005 SOL. Signature equality is exact,
  // so legitimate small native sends with no matching token tx stay
  // visible.
  const tokenTxSigsByChain = useMemo(() => {
    const byChain: Record<string, Set<string>> = {}
    for (const b of balances) {
      if (!b.token) continue
      const set = byChain[b.chain] ?? (byChain[b.chain] = new Set<string>())
      for (const tx of b.transactions ?? []) set.add(tx.hash)
    }
    return byChain
  }, [balances])

  useEffect(() => {
    if (contentReady) {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0

      requestAnimationFrame(() => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      })
    }
  }, [contentReady])

  const getExplorerLink = (chain: string, hash: string) => {
    const explorers: Record<string, string> = {
      bitcoin: `https://blockstream.info/tx/${hash}`,
      ethereum: `https://etherscan.io/tx/${hash}`,
      solana: `https://explorer.solana.com/tx/${hash}`,
    }
    return explorers[chain] || "#"
  }

  // Single skeleton path: stay on `<WalletSkeleton/>` until session, ownership
  // AND balances are all ready. Previously the page swapped to its real
  // layout the moment ownership reported ready, then immediately rendered a
  // second inline row-skeleton while balances were still loading - visually
  // a two-skeleton flash.
  const skeletonRows = 4
  if (status === "loading") {
    return <WalletSkeleton rows={skeletonRows} />
  }

  if (status === "unauthenticated") {
    redirect("/")
  }

  if (!contentReady || isLoadingBalances) {
    return <WalletSkeleton rows={skeletonRows} />
  }

  return (
    <>
      <div className="flex flex-col">
        <main className="flex-1 container mx-auto px-4 py-7 md:py-11">
          <div className="max-w-2xl mx-auto space-y-7">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">{t("title")}</h1>
              {balances.length > 0 &&
                (() => {
                  const totalFiat = balances.reduce((sum, balance) => {
                    return sum + getFiatValue(balance)
                  }, 0)

                  const hasBalance = totalFiat > 0

                  return (
                    <button
                      onClick={cycleCurrencyMode}
                      aria-label={t("currencyToggleAria", { mode: currencyMode === "HIDDEN" ? "hidden" : currencyMode })}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        hasBalance
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/15"
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      }`}
                    >
                      ≈ {formatCurrency(totalFiat)}
                    </button>
                  )
                })()}
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-muted-foreground">{t("balancesHeading")}</h2>
                  <Button
                    onClick={handleReload}
                    disabled={reloadDisabled || isReloading}
                    variant="ghost"
                    size="sm"
                    className="gap-2 h-8"
                  >
                    <RefreshCw className={`w-4 h-4 ${isReloading ? "animate-spin" : ""}`} />
                    <span className="sr-only">{t("reloadAria")}</span>
                  </Button>
                </div>
                <div className="space-y-3">
                  {balances.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{t("noAddresses")}</div>
                  ) : (
                    balances.map((balance) => {
                      const key = assetKey(balance)
                      return (
                        <BalanceCard
                          key={key}
                          balance={balance}
                          expanded={expandedAsset === key}
                          onToggle={() => setExpandedAsset(expandedAsset === key ? null : key)}
                          currencyMode={currencyMode}
                          formatCurrency={formatCurrency}
                          getFiatValue={getFiatValue}
                          showAllTransactions={showAllTransactions[key] ?? false}
                          onShowMore={() => setShowAllTransactions((prev) => ({ ...prev, [key]: true }))}
                          addressHandles={addressHandles}
                          getExplorerLink={getExplorerLink}
                          tokenTxSigs={tokenTxSigsByChain[balance.chain]}
                        />
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button onClick={() => setShowSendDialog(true)} className="gap-2">
                <Send className="w-4 h-4" />
                {t("sendButton")}
              </Button>
            </div>
          </div>
        </main>
      </div>

      {ownershipId && session?.user?.email && (
        <SendFlow
          open={showSendDialog}
          onOpenChange={setShowSendDialog}
          ownershipId={ownershipId}
          balances={balances}
        />
      )}
    </>
  )
}

function BalanceCard({
  balance,
  expanded,
  onToggle,
  currencyMode,
  formatCurrency,
  getFiatValue,
  showAllTransactions,
  onShowMore,
  addressHandles,
  getExplorerLink,
  tokenTxSigs,
}: {
  balance: Balance
  expanded: boolean
  onToggle: () => void
  currencyMode: string
  formatCurrency: (amount: number) => string
  getFiatValue: (balance: Balance) => number
  showAllTransactions: boolean
  onShowMore: () => void
  addressHandles: Record<string, { handle: string; avatarUrl: string | null }>
  getExplorerLink: (chain: string, hash: string) => string
  tokenTxSigs?: Set<string>
}) {
  const t = useTranslations("wallet")
  const _locale = useLocale()
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
            <Image
              src={balance.logo || "/placeholder.svg"}
              alt={balance.name}
              width={24}
              height={24}
              className="w-6 h-6"
            />
          </div>
          <div className="text-left">
            <p className="font-medium text-foreground">{balance.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-medium text-foreground text-sm">
              {formatAssetAmount(balance)} {balance.symbol}
            </p>
            {currencyMode !== "HIDDEN" && (
              <p className="text-xs text-muted-foreground">{formatCurrency(getFiatValue(balance))}</p>
            )}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border bg-secondary/30 space-y-3">
          <div className="text-xs text-muted-foreground space-y-1 pb-2">
            {balance.token === "USDC" ? (
              <p>{t("chainDescriptions.usdc")}</p>
            ) : balance.chain === "bitcoin" ? (
              <p>{t("chainDescriptions.bitcoin")}</p>
            ) : balance.chain === "ethereum" ? (
              <p>{t("chainDescriptions.ethereum")}</p>
            ) : balance.chain === "solana" ? (
              <p>{t("chainDescriptions.solana")}</p>
            ) : null}
          </div>
          {balance.subBalances && balance.subBalances.length > 0 ? (
            <div className="space-y-2">
              {balance.subBalances.map((sub) => (
                <div
                  key={sub.chain}
                  className="bg-background border border-border rounded p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Image
                      src={sub.logo || "/placeholder.svg"}
                      alt={sub.name}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full"
                    />
                    <p className="text-sm text-foreground truncate">{sub.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-foreground">
                      {formatAssetAmount(sub)} {sub.symbol}
                    </p>
                    {currencyMode !== "HIDDEN" && (
                      <p className="text-[11px] text-muted-foreground">{formatCurrency(getFiatValue(sub))}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TransactionList
              balance={balance}
              showAllTransactions={showAllTransactions}
              onShowMore={onShowMore}
              addressHandles={addressHandles}
              getExplorerLink={getExplorerLink}
              currencyMode={currencyMode}
              formatCurrency={formatCurrency}
              tokenTxSigs={tokenTxSigs}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Amount formatting ──────────────────────────────────────────────────────

/**
 * Display a balance with two decimal places across all assets.
 * The full chain-native precision is still preserved in `balance.balance`
 * for any consumer that needs it (send-flow inputs, signatures, etc.).
 */
function formatAssetAmount(balance: Balance): string {
  const n = Number.parseFloat(balance.balance)
  if (!Number.isFinite(n)) return balance.balance
  return n.toFixed(2)
}

/** Same convention as `formatAssetAmount` but for a transaction's value string. */
function formatTxAmount(_balance: Balance, value: string): string {
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return value
  return n.toFixed(2)
}

// ── Spam detection ──────────────────────────────────────────────────────────

function isSuspectedSpam(
  tx: Transaction,
  priceUSD: number | undefined,
  addressHandles: Record<string, { handle: string; avatarUrl: string | null }>,
): boolean {
  if (tx.direction !== "incoming") return false
  const counterparty = tx.from
  if (addressHandles[counterparty?.toLowerCase() ?? ""]) return false
  const val = parseFloat(tx.value)
  if (!val) return true
  const price = priceUSD ?? 0
  return price > 0 && val * price < 0.10
}

// ── Transaction list (inbox model: activity + filtered) ─────────────────────

function TransactionList({
  balance,
  showAllTransactions,
  onShowMore,
  addressHandles,
  getExplorerLink,
  currencyMode,
  formatCurrency,
  tokenTxSigs,
}: {
  balance: Balance
  showAllTransactions: boolean
  onShowMore: () => void
  addressHandles: Record<string, { handle: string; avatarUrl: string | null }>
  getExplorerLink: (chain: string, hash: string) => string
  currencyMode: string
  formatCurrency: (amount: number) => string
  tokenTxSigs?: Set<string>
}) {
  const t = useTranslations("wallet")
  const locale = useLocale()
  const [showFiltered, setShowFiltered] = useState(false)

  const allTx = balance.transactions ?? []
  const activity: Transaction[] = []
  const filtered: Transaction[] = []
  // A native-chain tx whose signature also shows up in a token's tx list
  // is the SOL/ETH fee leg of an SPL/ERC-20 transfer and should be hidden
  // from the main list (the token row already represents the real action).
  const isTokenFeeLeg = (tx: Transaction): boolean => !balance.token && !!tokenTxSigs?.has(tx.hash)
  for (const tx of allTx) {
    if (isSuspectedSpam(tx, balance.priceUSD, addressHandles) || isTokenFeeLeg(tx)) {
      filtered.push(tx)
    } else {
      activity.push(tx)
    }
  }

  const visibleActivity = activity.slice(0, showAllTransactions ? 10 : 3)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t("recentTransactions")}</p>
      {allTx.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">{t("noRecentTransactions")}</p>
      ) : activity.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">{t("noRecentTransactions")}</p>
      ) : (
        <div className="space-y-2">
          {visibleActivity.map((tx) => (
            <TransactionRow
              key={tx.hash}
              tx={tx}
              balance={balance}
              addressHandles={addressHandles}
              getExplorerLink={getExplorerLink}
              currencyMode={currencyMode}
              formatCurrency={formatCurrency}
              locale={locale}
            />
          ))}
          {activity.length > 3 && !showAllTransactions && (
            <button
              onClick={onShowMore}
              aria-expanded={false}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {t("showMore")}
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setShowFiltered(!showFiltered)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full"
          >
            <AlertTriangle className="w-3 h-3" />
            <span>{t("filteredTransactions", { count: filtered.length })}</span>
          </button>

          {showFiltered && (
            <div className="mt-2 space-y-2">
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  <p className="text-xs font-medium text-yellow-500">{t("filteredTitle")}</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t("filteredExplainer")}</p>
              </div>
              {filtered.map((tx) => (
                <div key={tx.hash} className="opacity-50">
                  <TransactionRow
                    tx={tx}
                    balance={balance}
                    addressHandles={addressHandles}
                    getExplorerLink={getExplorerLink}
                    currencyMode={currencyMode}
                    formatCurrency={formatCurrency}
                    locale={locale}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Single transaction row ──────────────────────────────────────────────────

function TransactionRow({
  tx,
  balance,
  addressHandles,
  getExplorerLink,
  currencyMode,
  formatCurrency,
  locale,
}: {
  tx: Transaction
  balance: Balance
  addressHandles: Record<string, { handle: string; avatarUrl: string | null }>
  getExplorerLink: (chain: string, hash: string) => string
  currencyMode: string
  formatCurrency: (amount: number) => string
  locale: string
}) {
  const t = useTranslations("wallet")
  const counterparty = tx.direction === "incoming" ? tx.from : tx.to
  const resolved = addressHandles[counterparty?.toLowerCase() ?? ""]
  const hue = (counterparty ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360

  return (
    <div
      className={`bg-background rounded border p-2.5 ${tx.status === "pending" ? "border-orange-500/40" : "border-border"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {resolved?.avatarUrl ? (
            <Image
              src={resolved.avatarUrl}
              alt={resolved.handle}
              width={28}
              height={28}
              className="rounded-full object-cover shrink-0"
              style={{ width: 28, height: 28 }}
            />
          ) : resolved ? (
            <CroodlesAvatar handle={resolved.handle} size={28} />
          ) : (
            <div
              className="rounded-full flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0"
              style={{ width: 28, height: 28, background: `hsl(${hue},52%,42%)` }}
            >
              {(counterparty ?? "??").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            {resolved && <p className="text-xs font-medium text-foreground">@{resolved.handle}</p>}
            <p className="font-mono text-xs text-muted-foreground truncate">
              {(counterparty ?? "").slice(0, 6)}…{(counterparty ?? "").slice(-6)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span
              className={`text-xs font-medium ${
                tx.status === "pending"
                  ? "text-orange-500"
                  : tx.direction === "incoming"
                    ? "text-green-600 dark:text-green-500"
                    : "text-red-600 dark:text-red-500"
              }`}
            >
              {tx.direction === "incoming" ? "+" : "-"}{formatTxAmount(balance, tx.value)} {balance.symbol}
            </span>
            {currencyMode !== "HIDDEN" && (() => {
              const txVal = parseFloat(tx.value)
              if (!txVal) return null
              const price = currencyMode === "EUR" ? balance.priceEUR : balance.priceUSD
              if (!price) return null
              const txFiat = txVal * price
              return (
                <p className="text-[10px] text-muted-foreground">{formatCurrency(txFiat)}</p>
              )
            })()}
          </div>
          <a
            href={getExplorerLink(balance.chain, tx.hash)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("viewOnExplorerAria")}
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>
      <p className={`text-xs mt-1.5 pl-9 ${tx.status === "pending" ? "text-orange-500" : "text-muted-foreground"}`}>
        {tx.status === "pending" ? t("pending") : formatRelativeTime(tx.timestamp, locale)}
      </p>
    </div>
  )
}
