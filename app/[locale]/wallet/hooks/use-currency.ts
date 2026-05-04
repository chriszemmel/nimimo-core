"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import type { Balance } from "@/lib/wallet/types"

type CurrencyMode = "EUR" | "USD" | "HIDDEN"

const STORAGE_KEY = "nimimo:currency-mode"

function getDefaultMode(): CurrencyMode {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "EUR" || stored === "USD" || stored === "HIDDEN") return stored
  }
  const locale = typeof navigator !== "undefined" ? navigator.language : "en-US"
  const isEuro =
    locale.startsWith("de") || locale.startsWith("fr") || locale.startsWith("es") || locale.startsWith("it")
  return isEuro ? "EUR" : "USD"
}

// In-memory listeners so multiple useCurrency() instances in the same page stay in sync.
// (The storage event only fires across tabs, not within the same tab.)
const listeners = new Set<() => void>()
let currentMode: CurrencyMode = getDefaultMode()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return currentMode
}

function setMode(mode: CurrencyMode) {
  currentMode = mode
  localStorage.setItem(STORAGE_KEY, mode)
  listeners.forEach((cb) => cb())
}

export function useCurrency() {
  const currencyMode = useSyncExternalStore(subscribe, getSnapshot, getDefaultMode)

  // Sync from other tabs via storage event
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const val = e.newValue as CurrencyMode
        if (val === "EUR" || val === "USD" || val === "HIDDEN") {
          currentMode = val
          listeners.forEach((cb) => cb())
        }
      }
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])

  const cycleCurrencyMode = useCallback(() => {
    const next = currentMode === "EUR" ? "USD" : currentMode === "USD" ? "HIDDEN" : "EUR"
    setMode(next)
  }, [])

  const getFiatValue = useCallback((balance: Balance): number => {
    if (currencyMode === "EUR") {
      return balance.balanceFiatEUR ?? 0
    }
    return balance.balanceFiatUSD ?? 0
  }, [currencyMode])

  const formatCurrency = useCallback((amount: number) => {
    if (currencyMode === "HIDDEN") return "****"
    if (currencyMode === "EUR") {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount)
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }, [currencyMode])

  return { currencyMode, cycleCurrencyMode, getFiatValue, formatCurrency }
}
