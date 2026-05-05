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
import { ripemd160 } from "@noble/hashes/legacy.js"
import { BIP39_WORDLIST } from "@/lib/ownership/bip39-wordlist"

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
