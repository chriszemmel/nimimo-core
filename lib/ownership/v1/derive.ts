// Address derivation for Ownership V1
// Uses battle-tested bip39, @scure/bip32, and @noble/hashes libraries.

"use client"

import * as bip39 from "bip39"
import { HDKey } from "@scure/bip32"
import { bech32 } from "bech32"
import { derivePath } from "ed25519-hd-key"
import bs58 from "bs58"
import { sha256 } from "@noble/hashes/sha2.js"
import { ripemd160 } from "@noble/hashes/legacy.js"
import nacl from "tweetnacl"
import { HDNodeWallet } from "ethers"
import { Buffer } from "buffer"
import { MANDATORY_V1_CHAINS } from "./chains"
import { logger } from "@/lib/logger"

const log = logger("derive")

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

function hash160(buffer: Uint8Array): Uint8Array {
  return ripemd160(sha256(buffer))
}

// Bitcoin: Derive Native SegWit (Bech32) address
function deriveBitcoinAddress(hdKey: HDKey): string {
  const pubKeyHash = hash160(hdKey.publicKey!)
  const words = bech32.toWords(pubKeyHash)
  words.unshift(0) // witness version v0
  return bech32.encode("bc", words)
}

// Ethereum: Derive checksummed address
function deriveEthereumAddress(mnemonic: string, path: string): string {
  const wallet = HDNodeWallet.fromPhrase(mnemonic, "", path)
  return wallet.address
}

// Solana: Derive address using Trust Wallet derivation with tweetnacl
function deriveSolanaAddress(seed: Uint8Array): string {
  const seedHex = Buffer.from(seed).toString("hex")
  const { key } = derivePath("m/44'/501'/0'", seedHex)
  const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(key))
  return bs58.encode(keypair.publicKey)
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
          address = deriveBitcoinAddress(hdKey)
        } else if (chain.chain === "ethereum") {
          address = deriveEthereumAddress(seedPhrase, chain.derivationPath)
        } else if (chain.chain === "solana") {
          address = deriveSolanaAddress(new Uint8Array(seed))
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
