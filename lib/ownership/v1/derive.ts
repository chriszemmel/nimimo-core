// Address derivation for Ownership V1
// Uses battle-tested bip39 and @scure/bip32 libraries

"use client"

import * as bip39 from "bip39"
import { HDKey } from "@scure/bip32"
import { bech32 } from "bech32"
import { derivePath } from "ed25519-hd-key"
import bs58 from "bs58"
import { MANDATORY_V1_CHAINS } from "./chains"
import { Buffer } from "buffer"
import { logger } from "@/lib/logger"

const log = logger("derive")
import nacl from "tweetnacl"
import { HDNodeWallet } from "ethers"

export interface DerivedAddress {
  chain: string
  symbol: string
  name: string
  address: string
  derivationPath: string
  logo: string
}

export interface AddressDerivationResult {
  success: boolean
  addresses: DerivedAddress[]
  error?: string
}

// Bitcoin: Derive Native SegWit (Bech32) address
async function deriveBitcoinAddress(hdKey: HDKey): Promise<string> {
  const pubKeyHash = await hash160(hdKey.publicKey!)
  const words = bech32.toWords(pubKeyHash)
  words.unshift(0) // witness version v0
  return bech32.encode("bc", words)
}

// Ethereum: Derive checksummed address
async function deriveEthereumAddress(mnemonic: string, path: string): Promise<string> {
  const wallet = HDNodeWallet.fromPhrase(mnemonic, "", path)
  return wallet.address
}

// Solana: Derive address using Trust Wallet derivation with tweetnacl
async function deriveSolanaAddress(seed: Uint8Array): Promise<string> {
  // Convert seed to hex string for derivePath
  const seedHex = Buffer.from(seed).toString("hex")

  // Derive m/44'/501'/0' using hex seed string
  const { key } = derivePath("m/44'/501'/0'", seedHex)

  // Ed25519 keypair from 32-byte seed
  const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(key))

  // Base58-encode the public key
  return bs58.encode(keypair.publicKey)
}

function _decompressSecp256k1(compressed: Uint8Array): Uint8Array {
  const p = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn
  const prefix = compressed[0]
  const x = BigInt("0x" + Buffer.from(compressed.slice(1)).toString("hex"))

  // y² = x³ + 7 (mod p)
  const ySquared = (x ** 3n + 7n) % p

  // Calculate y using Tonelli-Shanks (works for p ≡ 3 mod 4)
  let y = modPow(ySquared, (p + 1n) / 4n, p)

  // Choose correct y based on prefix (0x02 = even, 0x03 = odd)
  if ((prefix === 0x02 && y % 2n !== 0n) || (prefix === 0x03 && y % 2n === 0n)) {
    y = p - y
  }

  // Return 0x04 || x || y (65 bytes)
  const result = new Uint8Array(65)
  result[0] = 0x04
  result.set(hexToBytes(x.toString(16).padStart(64, "0")), 1)
  result.set(hexToBytes(y.toString(16).padStart(64, "0")), 33)
  return result
}

async function _deriveEd25519PublicKey(privateSeed: Uint8Array): Promise<Uint8Array> {
  // Import the private key
  const privateKey = await crypto.subtle.importKey(
    "raw",
    privateSeed.slice(0, 32), // Ed25519 uses 32-byte seeds
    { name: "Ed25519", namedCurve: "Ed25519" } as AlgorithmIdentifier,
    true,
    ["sign"],
  )

  // Export as JWK to get the public key
  const jwk = await crypto.subtle.exportKey("jwk", privateKey)

  if (!jwk.x) {
    throw new Error("Failed to derive Ed25519 public key")
  }

  // Decode base64url to get the 32-byte public key
  return new Uint8Array(Buffer.from(jwk.x, "base64"))
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n
  base = base % modulus
  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = (result * base) % modulus
    }
    exponent = exponent >> 1n
    base = (base * base) % modulus
  }
  return result
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

// Main export function
// #region derive
export async function deriveV1Addresses(seedPhrase: string): Promise<AddressDerivationResult> {
  try {
    const seed = await bip39.mnemonicToSeed(seedPhrase)
    const masterKey = HDKey.fromMasterSeed(new Uint8Array(seed))

    const addresses: DerivedAddress[] = []

    for (const chain of MANDATORY_V1_CHAINS) {
      try {
        let address: string

        if (chain.chain === "bitcoin") {
          const hdKey = masterKey.derive(chain.derivationPath)
          address = await deriveBitcoinAddress(hdKey)
        } else if (chain.chain === "ethereum") {
          address = await deriveEthereumAddress(seedPhrase, chain.derivationPath)
        } else if (chain.chain === "solana") {
          address = await deriveSolanaAddress(new Uint8Array(seed))
        } else {
          throw new Error(`Unsupported chain: ${chain.chain}`)
        }

        addresses.push({
          chain: chain.chain,
          symbol: chain.symbol,
          name: chain.name,
          address,
          derivationPath: chain.derivationPath,
          logo: chain.logo,
        })
      } catch (chainError) {
        log.error(`Error deriving ${chain.name}`, chainError)
      }
    }

    return { success: true, addresses }
  } catch (error) {
    log.error("Address derivation failed", error)
    return { success: false, addresses: [], error: String(error) }
  }
}
// #endregion derive

// Manual RIPEMD-160 implementation
async function hash160(buffer: Uint8Array): Promise<Uint8Array> {
  const sha256Hash = crypto.subtle.digest("SHA-256", buffer as BufferSource)

  return sha256Hash.then((hash) => {
    const sha256 = new Uint8Array(hash)
    return ripemd160(sha256)
  })
}

function ripemd160(data: Uint8Array): Uint8Array {
  const output = new Uint8Array(20)

  // RIPEMD-160 implementation
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

  // Padding
  const msgLen = data.length
  const padLen = msgLen + 9 + (64 - ((msgLen + 9) % 64))
  const padded = new Uint8Array(padLen)
  padded.set(data)
  padded[msgLen] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(padLen - 8, msgLen * 8, true)
  view.setUint32(padLen - 4, 0, true)

  // Initialize hash values
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0

  // Process blocks
  for (let offset = 0; offset < padded.length; offset += 64) {
    const X = new Uint32Array(16)
    for (let i = 0; i < 16; i++) {
      X[i] = view.getUint32(offset + i * 4, true)
    }

    let AL = h0,
      BL = h1,
      CL = h2,
      DL = h3,
      EL = h4
    let AR = h0,
      BR = h1,
      CR = h2,
      DR = h3,
      ER = h4

    const r_L = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10,
      14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9,
      7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
    ]
    const r_R = [
      5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5,
      1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10,
      4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
    ]
    const s_L = [
      11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
      11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9,
      15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
    ]
    const s_R = [
      8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9,
      7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5,
      12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
    ]

    for (let j = 0; j < 80; j++) {
      let T_L = (AL + f(j, BL, CL, DL) + X[r_L[j]] + K_L[Math.floor(j / 16)]) >>> 0
      T_L = (rol(T_L, s_L[j]) + EL) >>> 0
      AL = EL
      EL = DL
      DL = rol(CL, 10)
      CL = BL
      BL = T_L

      let T_R = (AR + f(79 - j, BR, CR, DR) + X[r_R[j]] + K_R[Math.floor(j / 16)]) >>> 0
      T_R = (rol(T_R, s_R[j]) + ER) >>> 0
      AR = ER
      ER = DR
      DR = rol(CR, 10)
      CR = BR
      BR = T_R
    }

    const T = (h1 + CL + DR) >>> 0
    h1 = (h2 + DL + ER) >>> 0
    h2 = (h3 + EL + AR) >>> 0
    h3 = (h4 + AL + BR) >>> 0
    h4 = (h0 + BL + CR) >>> 0
    h0 = T
  }

  const result = new DataView(output.buffer)
  result.setUint32(0, h0, true)
  result.setUint32(4, h1, true)
  result.setUint32(8, h2, true)
  result.setUint32(12, h3, true)
  result.setUint32(16, h4, true)

  return output
}

// Inline Keccak-256 implementation
function keccak256(data: Uint8Array): Uint8Array {
  // Keccak-256 implementation
  const ROUNDS = 24
  const RC = [
    0x0000000000000001n,
    0x0000000000008082n,
    0x800000000000808an,
    0x8000000080008000n,
    0x000000000000808bn,
    0x0000000080000001n,
    0x8000000080008081n,
    0x8000000000008009n,
    0x000000000000008an,
    0x0000000000000088n,
    0x0000000080000009n,
    0x000000008000000an,
    0x000000008000808bn,
    0x800000000000008bn,
    0x8000000000008089n,
    0x8000000000008003n,
    0x8000000000008002n,
    0x8000000000000080n,
    0x000000008000000an,
    0x800000008000800an,
    0x8000000080008081n,
    0x8000000000008080n,
    0x0000000080000001n,
    0x8000000080008008n,
  ]

  const rotations = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
  ]

  function rotl64(n: bigint, shift: number): bigint {
    return ((n << BigInt(shift)) | (n >> BigInt(64 - shift))) & 0xffffffffffffffffn
  }

  // Pad the data
  const rate = 136
  const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate)
  padded.set(data)
  padded[data.length] = 0x01
  padded[padded.length - 1] |= 0x80

  // Initialize state
  const state = new BigUint64Array(25)

  // Absorb phase
  for (let i = 0; i < padded.length; i += rate) {
    for (let j = 0; j < rate / 8; j++) {
      let lane = 0n
      for (let k = 0; k < 8; k++) {
        lane |= BigInt(padded[i + j * 8 + k]) << BigInt(k * 8)
      }
      state[j] ^= lane
    }

    // Keccak-f[1600] permutation
    for (let round = 0; round < ROUNDS; round++) {
      // θ step
      const C = new BigUint64Array(5)
      for (let x = 0; x < 5; x++) {
        C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20]
      }
      const D = new BigUint64Array(5)
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1)
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + y * 5] ^= D[x]
        }
      }

      // ρ and π steps
      const B = new BigUint64Array(25)
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          B[y + ((2 * x + 3 * y) % 5) * 5] = rotl64(state[x + y * 5], rotations[y][x])
        }
      }

      // χ step
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const idx = x + y * 5
          state[idx] = B[idx] ^ ((B[((x + 1) % 5) + y * 5] ^ 0xffffffffffffffffn) & B[((x + 2) % 5) + y * 5])
        }
      }

      // ι step
      state[0] ^= RC[round]
    }
  }

  // Squeeze phase (output first 256 bits)
  const output = new Uint8Array(32)
  for (let i = 0; i < 4; i++) {
    const lane = state[i]
    for (let j = 0; j < 8; j++) {
      output[i * 8 + j] = Number((lane >> BigInt(j * 8)) & 0xffn)
    }
  }
  return output
}

function _toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace("0x", "")
  const hash = keccak256(new Uint8Array(Buffer.from(addr, "utf-8")))
  let checksumAddr = "0x"

  for (let i = 0; i < addr.length; i++) {
    if (Number.parseInt(hash[i >> 1].toString(16)[i % 2 === 0 ? 0 : 1], 16) >= 8) {
      checksumAddr += addr[i].toUpperCase()
    } else {
      checksumAddr += addr[i]
    }
  }

  return checksumAddr
}
