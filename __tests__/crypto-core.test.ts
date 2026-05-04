/**
 * Crypto core tests - BIP-39 generation, multi-chain address derivation,
 * and recovery encryption round-trip.
 */

import { describe, it, expect } from "vitest"
import * as bip39 from "bip39"
import { HDKey } from "@scure/bip32"
import { bech32 } from "bech32"
import { derivePath } from "ed25519-hd-key"
import bs58 from "bs58"
import nacl from "tweetnacl"
import { Wallet } from "ethers"
import { Buffer } from "buffer"
import { BIP39_WORDLIST } from "@/lib/ownership/bip39-wordlist"

// ─── Inline RIPEMD-160 (copied from derive.ts for test use) ─────────────
function ripemd160(data: Uint8Array): Uint8Array {
  const output = new Uint8Array(20)
  const K_L = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e]
  const K_R = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000]
  function f(j: number, x: number, y: number, z: number): number {
    if (j < 16) return x ^ y ^ z
    if (j < 32) return (x & y) | (~x & z)
    if (j < 48) return (x | ~y) ^ z
    if (j < 64) return (x & z) | (y & ~z)
    return x ^ (y | ~z)
  }
  function rol(n: number, b: number): number {
    return ((n << b) | (n >>> (32 - b))) >>> 0
  }
  const msgLen = data.length
  const padLen = msgLen + 9 + (64 - ((msgLen + 9) % 64))
  const padded = new Uint8Array(padLen)
  padded.set(data)
  padded[msgLen] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padLen - 8, msgLen * 8, true)
  view.setUint32(padLen - 4, 0, true)
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0
  for (let offset = 0; offset < padded.length; offset += 64) {
    const X = new Uint32Array(16)
    for (let i = 0; i < 16; i++) X[i] = view.getUint32(offset + i * 4, true)
    let AL = h0, BL = h1, CL = h2, DL = h3, EL = h4
    let AR = h0, BR = h1, CR = h2, DR = h3, ER = h4
    const r_L = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13]
    const r_R = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11]
    const s_L = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6]
    const s_R = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]
    for (let j = 0; j < 80; j++) {
      let T_L = (AL + f(j, BL, CL, DL) + X[r_L[j]] + K_L[Math.floor(j / 16)]) >>> 0
      T_L = (rol(T_L, s_L[j]) + EL) >>> 0; AL = EL; EL = DL; DL = rol(CL, 10); CL = BL; BL = T_L
      let T_R = (AR + f(79 - j, BR, CR, DR) + X[r_R[j]] + K_R[Math.floor(j / 16)]) >>> 0
      T_R = (rol(T_R, s_R[j]) + ER) >>> 0; AR = ER; ER = DR; DR = rol(CR, 10); CR = BR; BR = T_R
    }
    const T = (h1 + CL + DR) >>> 0
    h1 = (h2 + DL + ER) >>> 0; h2 = (h3 + EL + AR) >>> 0; h3 = (h4 + AL + BR) >>> 0; h4 = (h0 + BL + CR) >>> 0; h0 = T
  }
  const result = new DataView(output.buffer)
  result.setUint32(0, h0, true); result.setUint32(4, h1, true); result.setUint32(8, h2, true); result.setUint32(12, h3, true); result.setUint32(16, h4, true)
  return output
}

// ─── Known test vector ──────────────────────────────────────────────────
// "abandon" x 23 + "art" is the standard BIP-39 test mnemonic for 256-bit entropy.
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"

// ─── BIP-39 Mnemonic Tests ──────────────────────────────────────────────

describe("BIP-39 Mnemonic", () => {
  it("test mnemonic is valid BIP-39", () => {
    expect(bip39.validateMnemonic(TEST_MNEMONIC)).toBe(true)
  })

  it("generates valid 24-word mnemonic from 256-bit entropy", async () => {
    const entropy = crypto.getRandomValues(new Uint8Array(32))
    const mnemonic = bip39.entropyToMnemonic(Buffer.from(entropy).toString("hex"))
    const words = mnemonic.split(" ")

    expect(words).toHaveLength(24)
    for (const word of words) {
      expect(BIP39_WORDLIST).toContain(word)
    }
    expect(bip39.validateMnemonic(mnemonic)).toBe(true)
  })

  it("different entropy produces different mnemonics", async () => {
    const e1 = crypto.getRandomValues(new Uint8Array(32))
    const e2 = crypto.getRandomValues(new Uint8Array(32))
    const m1 = bip39.entropyToMnemonic(Buffer.from(e1).toString("hex"))
    const m2 = bip39.entropyToMnemonic(Buffer.from(e2).toString("hex"))
    expect(m1).not.toBe(m2)
  })

  it("same entropy always produces same mnemonic (deterministic)", () => {
    const hex = "00".repeat(32)
    const m1 = bip39.entropyToMnemonic(hex)
    const m2 = bip39.entropyToMnemonic(hex)
    expect(m1).toBe(m2)
  })

  it("rejects invalid mnemonic (wrong word)", () => {
    const bad = TEST_MNEMONIC.replace("art", "zzzzz")
    expect(bip39.validateMnemonic(bad)).toBe(false)
  })

  it("rejects invalid mnemonic (wrong checksum)", () => {
    const bad = TEST_MNEMONIC.replace("art", "abandon")
    expect(bip39.validateMnemonic(bad)).toBe(false)
  })
})

// ─── Bitcoin Address Derivation ─────────────────────────────────────────

describe("Bitcoin address derivation (BIP-84 P2WPKH)", () => {
  it("derives correct BIP-84 child key from test mnemonic", async () => {
    const seed = await bip39.mnemonicToSeed(TEST_MNEMONIC)
    const master = HDKey.fromMasterSeed(new Uint8Array(seed))
    const child = master.derive("m/84'/0'/0'/0/0")

    expect(child.publicKey).toBeDefined()
    expect(child.publicKey!.length).toBe(33) // compressed secp256k1 pubkey
    // Prefix must be 0x02 or 0x03 (compressed point)
    expect([0x02, 0x03]).toContain(child.publicKey![0])
  })

  it("derives valid bc1 address with hash160 + bech32", async () => {
    const seed = await bip39.mnemonicToSeed(TEST_MNEMONIC)
    const master = HDKey.fromMasterSeed(new Uint8Array(seed))
    const child = master.derive("m/84'/0'/0'/0/0")

    // Inline ripemd160 from the project's own derive.ts (re-exported for testing)
    const sha256 = new Uint8Array(
      await crypto.subtle.digest("SHA-256", child.publicKey!)
    )
    const pubKeyHash = ripemd160(sha256)

    const words = bech32.toWords(pubKeyHash)
    words.unshift(0) // witness version 0
    const address = bech32.encode("bc", words)

    expect(address).toMatch(/^bc1q[a-z0-9]{38,42}$/)
    // Known address for this test vector
    expect(address).toBe("bc1qzmtrqsfuaf6l6kkcsseumq26ukaphfj9skkug6")
  })
})

// ─── Ethereum Address Derivation ────────────────────────────────────────

describe("Ethereum address derivation (BIP-44)", () => {
  it("derives valid checksummed 0x address from test mnemonic", async () => {
    const wallet = Wallet.fromPhrase(TEST_MNEMONIC)
    const address = wallet.address

    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    // Known Ethereum address for "abandon...art" on m/44'/60'/0'/0/0
    expect(address).toBe("0xF278cF59F82eDcf871d630F28EcC8056f25C1cdb")
  })
})

// ─── Solana Address Derivation ──────────────────────────────────────────

describe("Solana address derivation (Ed25519)", () => {
  it("derives valid base58 address from test mnemonic", async () => {
    const seed = await bip39.mnemonicToSeed(TEST_MNEMONIC)
    const seedHex = Buffer.from(seed).toString("hex")

    // Trust Wallet path: m/44'/501'/0'
    const { key } = derivePath("m/44'/501'/0'", seedHex)
    const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(key))
    const address = bs58.encode(keypair.publicKey)

    // Solana addresses are base58-encoded 32-byte public keys
    expect(address.length).toBeGreaterThanOrEqual(32)
    expect(address.length).toBeLessThanOrEqual(44)

    // Known Solana address for this mnemonic + path
    expect(address).toBe("4BZp4ci5rhNYqbayj1uppeTas1osK2Q4b74x7UENC5Hd")
  })
})

// ─── Production wrapper: deriveV1Addresses ─────────────────────────────
// The tests above verify that the underlying crypto libraries produce the
// expected vectors. This block verifies that the production wrapper in
// lib/ownership/v1/derive.ts (the function the recovery flow actually
// calls) wires those libraries together correctly. If someone refactors
// derive.ts and switches a derivation path, swaps a hash, or drops a
// chain, this test fails - the per-library tests above would not.

describe("deriveV1Addresses (production wrapper, known vectors)", () => {
  it("returns canonical BTC/ETH/SOL addresses for the standard test mnemonic", async () => {
    const { deriveV1Addresses } = await import("@/lib/ownership/v1/derive")
    const result = await deriveV1Addresses(TEST_MNEMONIC)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()

    const byChain = Object.fromEntries(
      result.addresses.map((a) => [a.chain, a]),
    )

    expect(byChain.bitcoin?.address).toBe(
      "bc1qzmtrqsfuaf6l6kkcsseumq26ukaphfj9skkug6",
    )
    expect(byChain.bitcoin?.derivationPath).toBe("m/84'/0'/0'/0/0")

    expect(byChain.ethereum?.address).toBe(
      "0xF278cF59F82eDcf871d630F28EcC8056f25C1cdb",
    )
    expect(byChain.ethereum?.derivationPath).toBe("m/44'/60'/0'/0/0")

    expect(byChain.solana?.address).toBe(
      "4BZp4ci5rhNYqbayj1uppeTas1osK2Q4b74x7UENC5Hd",
    )
    expect(byChain.solana?.derivationPath).toBe("m/44'/501'/0'")
  })

  it("documents partial-failure behavior on an unvalidated garbage mnemonic", async () => {
    // The recovery flow calls bip39.validateMnemonic before invoking this
    // wrapper, so in production garbage input never reaches here. This
    // test pins the wrapper's *current* behavior at the boundary so a
    // future refactor doesn't silently change it:
    //
    //   - BTC and SOL derive from a PBKDF2 hash of the input string and
    //     therefore always produce some (wrong) address without throwing.
    //   - ETH goes through HDNodeWallet.fromPhrase which validates the
    //     wordlist and throws - caught per-chain in derive.ts, so ETH
    //     simply doesn't appear in the result.
    //   - The wrapper still returns success:true with the surviving
    //     chains. That's a smell (callers can't tell ETH was dropped),
    //     but it's the contract today; flipping the test should be a
    //     deliberate decision when the wrapper is hardened.
    const { deriveV1Addresses } = await import("@/lib/ownership/v1/derive")
    const result = await deriveV1Addresses("not a real mnemonic at all")
    expect(result.success).toBe(true)
    const chains = result.addresses.map((a) => a.chain).sort()
    expect(chains).toEqual(["bitcoin", "solana"])
  })
})

// ─── Cross-chain Determinism ────────────────────────────────────────────

describe("Cross-chain derivation determinism", () => {
  it("same mnemonic always produces same addresses on all chains", async () => {
    const derive = async () => {
      const seed = await bip39.mnemonicToSeed(TEST_MNEMONIC)
      const master = HDKey.fromMasterSeed(new Uint8Array(seed))

      // BTC
      const btcChild = master.derive("m/84'/0'/0'/0/0")
      const sha256 = new Uint8Array(
        await crypto.subtle.digest("SHA-256", btcChild.publicKey!)
      )
      const pubKeyHash = ripemd160(sha256)
      const words = bech32.toWords(pubKeyHash)
      words.unshift(0)
      const btc = bech32.encode("bc", words)

      // ETH
      const eth = Wallet.fromPhrase(TEST_MNEMONIC).address

      // SOL
      const seedHex = Buffer.from(seed).toString("hex")
      const { key } = derivePath("m/44'/501'/0'", seedHex)
      const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(key))
      const sol = bs58.encode(keypair.publicKey)

      return { btc, eth, sol }
    }

    const a = await derive()
    const b = await derive()
    expect(a).toEqual(b)
  })
})

// ─── Recovery Encryption Round-trip ─────────────────────────────────────

describe("Recovery encryption (PIN-based, KEK₂)", () => {
  async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pin),
      "PBKDF2",
      false,
      ["deriveKey"],
    )
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 600000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    )
  }

  async function encrypt(data: string, pin: string) {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await derivePinKey(pin, salt)
    const encoder = new TextEncoder()
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(data),
    )
    return { encrypted: new Uint8Array(encrypted), iv, salt }
  }

  async function decrypt(encrypted: Uint8Array, iv: Uint8Array, salt: Uint8Array, pin: string) {
    const key = await derivePinKey(pin, salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted,
    )
    return new TextDecoder().decode(decrypted)
  }

  it("encrypt → decrypt round-trip preserves mnemonic", async () => {
    const { encrypted, iv, salt } = await encrypt(TEST_MNEMONIC, "12345678")
    const result = await decrypt(encrypted, iv, salt, "12345678")
    expect(result).toBe(TEST_MNEMONIC)
  })

  it("wrong PIN fails decryption", async () => {
    const { encrypted, iv, salt } = await encrypt(TEST_MNEMONIC, "12345678")
    await expect(decrypt(encrypted, iv, salt, "wrong-pin")).rejects.toThrow()
  })

  it("different salts produce different ciphertexts", async () => {
    const r1 = await encrypt(TEST_MNEMONIC, "12345678")
    const r2 = await encrypt(TEST_MNEMONIC, "12345678")
    // Different random salts/IVs = different ciphertext
    expect(Buffer.from(r1.encrypted)).not.toEqual(Buffer.from(r2.encrypted))
  })
})

// ─── Device-bound Encryption (KEK₁) ────────────────────────────────────

describe("Device-bound encryption (KEK₁)", () => {
  async function deriveKey(keyMaterialBytes: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      keyMaterialBytes,
      "PBKDF2",
      false,
      ["deriveKey"],
    )
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 600000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    )
  }

  it("encrypt → decrypt round-trip with AAD binding", async () => {
    const keyMaterialBytes = crypto.getRandomValues(new Uint8Array(32))
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const key = await deriveKey(keyMaterialBytes, salt)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ownershipId = crypto.randomUUID()
    const aad = new TextEncoder().encode(`v2:${ownershipId}`)

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      new TextEncoder().encode(TEST_MNEMONIC),
    )

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      encrypted,
    )

    expect(new TextDecoder().decode(decrypted)).toBe(TEST_MNEMONIC)
  })

  it("wrong AAD (different ownership_id) fails decryption", async () => {
    const keyMaterialBytes = crypto.getRandomValues(new Uint8Array(32))
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const key = await deriveKey(keyMaterialBytes, salt)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("v2:owner-a") },
      key,
      new TextEncoder().encode(TEST_MNEMONIC),
    )

    await expect(
      crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("v2:owner-b") },
        key,
        encrypted,
      ),
    ).rejects.toThrow()
  })

  it("different key material produces different keys", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const km1 = crypto.getRandomValues(new Uint8Array(32))
    const km2 = crypto.getRandomValues(new Uint8Array(32))
    const key1 = await deriveKey(km1, salt)
    const key2 = await deriveKey(km2, salt)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key1,
      new TextEncoder().encode("test"),
    )

    await expect(
      crypto.subtle.decrypt({ name: "AES-GCM", iv }, key2, encrypted),
    ).rejects.toThrow()
  })

  it("different salts produce different keys", async () => {
    const km = crypto.getRandomValues(new Uint8Array(32))
    const salt1 = crypto.getRandomValues(new Uint8Array(32))
    const salt2 = crypto.getRandomValues(new Uint8Array(32))
    const key1 = await deriveKey(km, salt1)
    const key2 = await deriveKey(km, salt2)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key1,
      new TextEncoder().encode("test"),
    )

    await expect(
      crypto.subtle.decrypt({ name: "AES-GCM", iv }, key2, encrypted),
    ).rejects.toThrow()
  })
})
