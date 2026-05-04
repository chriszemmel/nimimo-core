"use client"

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { WalletClient } from "@/lib/wallet/client"
import type { Balance, Transaction } from "@/lib/wallet/types"

// Module-scoped flag: when true, the next `useBalances` refetch bypasses
// the 60s Redis cache server-side (passes `?fresh=1`). Consumed on the
// first queryFn invocation that reads it, so it's single-shot.
let pendingFreshFetch = false

/**
 * Signal that the next balance refetch should bypass the server-side Redis
 * cache. Used by the send flow after a successful broadcast to make sure
 * the post-send balance reflects on-chain state instead of a cached
 * pre-send snapshot.
 */
export function markBalancesFresh() {
  pendingFreshFetch = true
}

// ── Optimistic pending transactions ──────────────────────────────────────────
//
// When the user broadcasts a send we know the tx exists (we have its
// signature) before the RPC's signature-history catches up. Rather than
// letting the UI show the pre-send state for a few seconds, we inject the
// tx immediately as `status: "pending"` so it shows up in the list in
// orange. The next poll that returns the same signature from the chain
// replaces it with the real entry (green/red for outgoing/incoming), and
// the optimistic stub is dropped.
//
// Failed broadcasts never get added (send flow only calls add on success).
// Stale optimistic entries expire after 10 minutes to cover the rare case
// where a tx drops from the mempool without making it on-chain.

export interface OptimisticSendTx {
  signature: string
  chain: string
  /** Undefined = native asset for the chain. "USDC" = SPL USDC on Solana. */
  token?: string
  from: string
  to: string
  /** Human-readable decimal string matching the chain's display format. */
  value: string
  /** ms since epoch when the broadcast returned. */
  timestamp: number
}

const OPTIMISTIC_TTL_MS = 10 * 60_000
let optimisticTxs: OptimisticSendTx[] = []

function sameAsset(a: { chain: string; token?: string }, b: { chain: string; token?: string }) {
  return a.chain === b.chain && (a.token ?? undefined) === (b.token ?? undefined)
}

/**
 * Remove optimistic entries whose signature is now visible in the real
 * transaction list (the chain has picked them up) or that are older than
 * OPTIMISTIC_TTL_MS (probably dropped from the mempool).
 */
function reconcileOptimistic(realSignatures: Set<string>) {
  const now = Date.now()
  optimisticTxs = optimisticTxs.filter(
    (p) => !realSignatures.has(p.signature) && now - p.timestamp < OPTIMISTIC_TTL_MS,
  )
}

/**
 * Inject still-pending optimistic entries into each balance's transaction
 * list, matched by asset. Optimistic txs render as `status: "pending"`
 * and always show as outgoing (we only optimistically track sends, not
 * receives - incoming is never user-initiated).
 */
function mergeOptimistic(balances: Balance[]): Balance[] {
  if (optimisticTxs.length === 0) return balances
  return balances.map((b) => {
    const matching = optimisticTxs.filter((p) => sameAsset(p, b))
    if (matching.length === 0) return b
    const stubs: Transaction[] = matching.map((p) => ({
      hash: p.signature,
      from: p.from,
      to: p.to,
      value: p.value,
      timestamp: p.timestamp,
      status: "pending",
      direction: "outgoing",
    }))
    return { ...b, transactions: [...stubs, ...(b.transactions ?? [])] }
  })
}

/**
 * Record a just-broadcast send so the UI renders it as pending until the
 * chain returns it from its signature history. Also seeds the react-query
 * cache synchronously so the tx appears without waiting for the next poll.
 */
export function addOptimisticSend(
  queryClient: QueryClient,
  ownershipId: string,
  tx: OptimisticSendTx,
) {
  optimisticTxs = optimisticTxs.filter((p) => p.signature !== tx.signature)
  optimisticTxs.push(tx)
  // Patch the cached balances immediately so the pending row shows up
  // before the first post-send refetch completes.
  queryClient.setQueryData<Balance[]>(["balances", ownershipId], (prev) => {
    if (!prev) return prev
    return mergeOptimistic(prev)
  })
  schedulePostSendPolling(queryClient, ownershipId)
}

// ── Post-send polling ────────────────────────────────────────────────────────
//
// Aggressively refetch balances after a send, then back off. Solana confirms
// in ~2s but the RPC indexer serving signature/balance reads can lag head a
// few seconds, so the dense early schedule catches the common case and the
// slower tail covers the outlier where the indexer takes 15-30s to surface
// the new entry.
//
// Module-scoped (not a useEffect inside SendFlow) so the schedule survives
// the dialog closing and the user navigating from the profile page to /wallet
// when they tap "Done". Tying these timeouts to component lifecycle was the
// origin of the "had to hit refresh on /wallet" bug: navigation away
// unmounted the dialog, the cleanup cancelled the pending polls, and the
// wallet page mounted before any of the post-send refetches had landed.

let pollingTimeouts: ReturnType<typeof setTimeout>[] = []

function schedulePostSendPolling(queryClient: QueryClient, ownershipId: string) {
  for (const t of pollingTimeouts) clearTimeout(t)
  pollingTimeouts = []
  const schedule = [0, 1500, 3000, 5000, 7500, 10_000, 13_000, 17_000, 22_000, 28_000]
  pollingTimeouts = schedule.map((ms) =>
    setTimeout(() => {
      markBalancesFresh()
      queryClient.invalidateQueries({ queryKey: ["balances", ownershipId] })
    }, ms),
  )
}

export function useBalances(ownershipId: string | null) {
  const queryClient = useQueryClient()
  const [reloadDisabled, setReloadDisabled] = useState(false)

  const { data: balances = [], isLoading: isLoadingBalances, isFetching: isReloading } = useQuery<Balance[]>({
    queryKey: ["balances", ownershipId],
    queryFn: async () => {
      const fresh = pendingFreshFetch
      pendingFreshFetch = false
      const walletClient = new WalletClient()
      const walletData = await walletClient.getBalances(ownershipId!, { fresh })
      const real = walletData.balances || []

      // Preserve previous transactions if the new fetch returned an empty
      // list for an asset that previously had history. On-chain history is
      // append-only, so "I had 3 txs a moment ago and now 0" is never a
      // real state transition, only an RPC indexer hiccup (confirmed
      // commitment lag, token-balance node desync, etc.). Blanking the UI
      // in that window is the bug the user saw.
      const prevBalances = queryClient.getQueryData<Balance[]>(["balances", ownershipId]) ?? []
      const stitched = real.map((b) => {
        const incomingCount = b.transactions?.length ?? 0
        if (incomingCount > 0) return b
        const prev = prevBalances.find(
          (p) => p.chain === b.chain && (p.token ?? undefined) === (b.token ?? undefined),
        )
        const prevCount = prev?.transactions?.length ?? 0
        if (prevCount > 0) return { ...b, transactions: prev!.transactions }
        return b
      })

      // Reconcile optimistic sends: drop entries whose signature is now
      // visible in the real fetch. Use the stitched list so carried-over
      // prior history still counts as "visible" for reconciliation.
      const realSigs = new Set<string>()
      for (const b of stitched) {
        for (const tx of b.transactions ?? []) realSigs.add(tx.hash)
      }
      reconcileOptimistic(realSigs)

      return mergeOptimistic(stitched)
    },
    enabled: !!ownershipId,
    staleTime: 30_000,
  })

  const handleReload = useCallback(async () => {
    if (!ownershipId || reloadDisabled) return

    setReloadDisabled(true)
    markBalancesFresh()
    await queryClient.invalidateQueries({ queryKey: ["balances", ownershipId] })

    setTimeout(() => {
      setReloadDisabled(false)
    }, 10_000)
  }, [ownershipId, reloadDisabled, queryClient])

  return { balances, isLoadingBalances, isReloading: isReloading && !isLoadingBalances, reloadDisabled, handleReload }
}
