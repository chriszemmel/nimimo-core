"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { apiFetch } from "@/lib/api-fetch"
import type { Balance } from "@/lib/wallet/types"

const BATCH_SIZE = 50

export function useTransactionHandles(balances: Balance[]) {
  const addressesToCheck = useMemo(() => {
    const myAddresses = new Set(balances.map((b) => b.address?.toLowerCase()).filter(Boolean))
    const toCheck = new Set<string>()
    for (const balance of balances) {
      for (const tx of balance.transactions ?? []) {
        const counterparty = tx.direction === "incoming" ? tx.from : tx.to
        if (counterparty && !myAddresses.has(counterparty.toLowerCase())) {
          toCheck.add(counterparty)
        }
      }
    }
    return [...toCheck].sort()
  }, [balances])

  const cacheKey = addressesToCheck.join(",")

  const { data: addressHandles = {} } = useQuery<Record<string, { handle: string; avatarUrl: string | null }>>({
    queryKey: ["transaction-handles", cacheKey],
    queryFn: async () => {
      const map: Record<string, { handle: string; avatarUrl: string | null }> = {}

      for (let i = 0; i < addressesToCheck.length; i += BATCH_SIZE) {
        const chunk = addressesToCheck.slice(i, i + BATCH_SIZE)
        try {
          const res = await apiFetch("/api/identity/by-addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addresses: chunk }),
          })
          if (res.ok) {
            const { results } = await res.json()
            for (const [addr, info] of Object.entries(results)) {
              const { handle, avatar_url } = info as { handle: string; avatar_url: string | null }
              map[addr.toLowerCase()] = { handle, avatarUrl: avatar_url ?? null }
            }
          }
        } catch {
          // Skip failed chunks - same resilience as previous per-address catch
        }
      }

      return map
    },
    enabled: addressesToCheck.length > 0,
    staleTime: 5 * 60_000,
  })

  return { addressHandles }
}
