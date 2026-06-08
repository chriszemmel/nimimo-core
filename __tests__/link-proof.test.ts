/**
 * Multi-device link proof tests.
 *
 * The client signs a message over public data (ownership_id + server nonce)
 * with the seed's Ethereum key; the server recovers the signer address. A
 * round-trip must recover the seed's canonical ETH address, and a proof made
 * with a different seed / nonce / ownership_id must NOT recover it.
 */

import { describe, it, expect } from "vitest"
import {
  ETH_LINK_PATH,
  buildLinkMessage,
  signLinkProof,
  recoverLinkSigner,
} from "@/lib/identity/link-proof"

// Standard BIP-39 test vector (256-bit entropy).
const MNEMONIC_A =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"
// Canonical ETH address for MNEMONIC_A on m/44'/60'/0'/0/0.
const ADDRESS_A = "0xF278cF59F82eDcf871d630F28EcC8056f25C1cdb"

const MNEMONIC_B =
  "legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title"

const OWNERSHIP_ID = "550e8400-e29b-41d4-a716-446655440000"
const NONCE = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

describe("link proof", () => {
  it("uses the same derivation path the public ethereum address is stored under", () => {
    expect(ETH_LINK_PATH).toBe("m/44'/60'/0'/0/0")
  })

  it("builds a versioned message bound to ownership_id + nonce", () => {
    expect(buildLinkMessage(OWNERSHIP_ID, NONCE)).toBe(`nimimo-link:v1:${OWNERSHIP_ID}:${NONCE}`)
  })

  it("round-trips: recovers the seed's ETH address", async () => {
    const sig = await signLinkProof(MNEMONIC_A, OWNERSHIP_ID, NONCE)
    const signer = recoverLinkSigner(OWNERSHIP_ID, NONCE, sig)
    expect(signer?.toLowerCase()).toBe(ADDRESS_A.toLowerCase())
  })

  it("a different seed does not recover the expected address", async () => {
    const sig = await signLinkProof(MNEMONIC_B, OWNERSHIP_ID, NONCE)
    const signer = recoverLinkSigner(OWNERSHIP_ID, NONCE, sig)
    expect(signer?.toLowerCase()).not.toBe(ADDRESS_A.toLowerCase())
  })

  it("a different nonce recovers a different signer than the original message", async () => {
    const sig = await signLinkProof(MNEMONIC_A, OWNERSHIP_ID, NONCE)
    const wrongNonce = NONCE.replace(/a/g, "b")
    // Verifying the signature against a tampered nonce yields a non-A address.
    const signer = recoverLinkSigner(OWNERSHIP_ID, wrongNonce, sig)
    expect(signer?.toLowerCase()).not.toBe(ADDRESS_A.toLowerCase())
  })

  it("a different ownership_id recovers a different signer than the original message", async () => {
    const sig = await signLinkProof(MNEMONIC_A, OWNERSHIP_ID, NONCE)
    const otherOwnership = "11111111-1111-1111-1111-111111111111"
    const signer = recoverLinkSigner(otherOwnership, NONCE, sig)
    expect(signer?.toLowerCase()).not.toBe(ADDRESS_A.toLowerCase())
  })

  it("returns null for a malformed signature", () => {
    expect(recoverLinkSigner(OWNERSHIP_ID, NONCE, "not-a-signature")).toBeNull()
  })
})
