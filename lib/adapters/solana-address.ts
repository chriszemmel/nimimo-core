// Server-safe Solana address validation. The client-side validator lives in
// `lib/wallet/solana-send.ts` which is marked `"use client"`. Importing that
// module into an API route would drag the client bundle into the server runtime.

import bs58 from "bs58"

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/** Validates a Solana address: base58-encoded public key (exactly 32 bytes). */
export function isValidSolanaAddressServer(addr: string): boolean {
  if (typeof addr !== "string" || !BASE58_RE.test(addr)) return false
  try {
    return bs58.decode(addr).length === 32
  } catch {
    return false
  }
}
