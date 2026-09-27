import { describe, it, expect } from "vitest"
import { selectBitcoinUtxos, estimateBtcFee, type BitcoinUTXO } from "@/lib/wallet/bitcoin-send"

// Helper: build a UTXO with a given value (sats) and confirmation state.
function utxo(value: number, confirmed: boolean): BitcoinUTXO {
  return {
    txid: value.toString(16).padStart(64, "0"),
    vout: 0,
    value,
    status: { confirmed },
  }
}

const sum = (utxos: BitcoinUTXO[]) => utxos.reduce((s, u) => s + BigInt(u.value), 0n)

describe("selectBitcoinUtxos", () => {
  // Sats-denominated round numbers (≈ the screenshot scenario scaled down):
  // a large coin and a handful of small ones.
  const LARGE = 15_100_000 // ~0.151 BTC change coin
  const SMALL_A = 3_200
  const SMALL_B = 4_400

  it("spends unconfirmed change when confirmed coins can't cover the send", () => {
    // The exact reported bug: a pending tx consumed the big coin, leaving its
    // change unconfirmed. Confirmed leftovers are tiny; the big send must
    // dip into the unconfirmed change instead of failing.
    const utxos = [
      utxo(SMALL_A, true),
      utxo(SMALL_B, true),
      utxo(LARGE, false), // unconfirmed self-change
    ]
    const target = 13_000_000n // more than the confirmed coins hold

    const result = selectBitcoinUtxos(utxos, target, 5)
    expect(result).not.toBeNull()
    expect(result!.selected).toHaveLength(1)
    expect(result!.selected[0].value).toBe(LARGE)
    expect(result!.totalIn).toBe(BigInt(LARGE))
  })

  it("prefers confirmed coins when they alone can cover the send", () => {
    const utxos = [
      utxo(SMALL_A, true),
      utxo(LARGE, false), // unconfirmed - must NOT be touched
    ]
    const target = 2_000n // SMALL_A covers this comfortably

    const result = selectBitcoinUtxos(utxos, target, 5)
    expect(result).not.toBeNull()
    expect(result!.selected.every((u) => u.status.confirmed)).toBe(true)
    expect(result!.selected[0].value).toBe(SMALL_A)
  })

  it("does not lock up a large coin for a small payment", () => {
    // Prevention: a tiny send must pick a small coin, never the big one -
    // otherwise the big coin's change goes unconfirmed and we recreate the bug.
    const utxos = [
      utxo(SMALL_A, true),
      utxo(SMALL_B, true),
      utxo(LARGE, true),
    ]
    const target = 1_000n

    const result = selectBitcoinUtxos(utxos, target, 5)
    expect(result).not.toBeNull()
    expect(result!.selected).toHaveLength(1)
    expect(result!.selected[0].value).toBe(SMALL_A) // smallest sufficient coin
  })

  it("accumulates largest-first when no single coin suffices", () => {
    const utxos = [
      utxo(5_000_000, true),
      utxo(6_000_000, true),
      utxo(4_000_000, true),
    ]
    const target = 12_000_000n // needs at least two coins

    const result = selectBitcoinUtxos(utxos, target, 5)
    expect(result).not.toBeNull()
    expect(result!.selected.length).toBeGreaterThanOrEqual(2)
    // Largest-first: 6M + 5M = 11M is short, so 4M is added → 15M total.
    expect(result!.totalIn).toBeGreaterThanOrEqual(
      target + estimateBtcFee(result!.selected.length, 5),
    )
  })

  it("prefers a confirmed multi-coin combination over a single unconfirmed coin", () => {
    // No single confirmed coin covers the send, but two together do - so
    // selection must accumulate the confirmed pair rather than fall back to
    // the unconfirmed coin.
    const utxos = [
      utxo(7_000_000, true),
      utxo(6_000_000, true),
      utxo(15_000_000, false), // unconfirmed - must NOT be touched
    ]
    const target = 12_000_000n

    const result = selectBitcoinUtxos(utxos, target, 5)
    expect(result).not.toBeNull()
    expect(result!.selected.every((u) => u.status.confirmed)).toBe(true)
    expect(result!.selected).toHaveLength(2)
  })

  it("returns null for an empty UTXO set", () => {
    expect(selectBitcoinUtxos([], 1_000n, 5)).toBeNull()
  })

  it("returns null when the full balance can't cover amount + fee", () => {
    const utxos = [utxo(SMALL_A, true), utxo(SMALL_B, false)]
    const target = sum(utxos) // can't also cover the fee

    expect(selectBitcoinUtxos(utxos, target, 5)).toBeNull()
  })

  it("accounts for the fee in the single-coin fit", () => {
    // A coin equal to the amount is NOT sufficient - it can't also pay the fee.
    const amount = 1_000_000n
    const fee = estimateBtcFee(1, 5)
    const exact = utxo(Number(amount), true)
    const enough = utxo(Number(amount + fee), true)

    expect(selectBitcoinUtxos([exact], amount, 5)).toBeNull()
    const ok = selectBitcoinUtxos([enough], amount, 5)
    expect(ok).not.toBeNull()
    expect(ok!.selected[0].value).toBe(Number(amount + fee))
  })
})
