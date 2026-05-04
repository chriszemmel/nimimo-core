"use client"

// Client-side Bitcoin P2WPKH transfer: derive keypair, build + sign segwit transaction.
// Uses @scure/bip32, @noble/curves/secp256k1, @noble/hashes, bip39, bech32.
// Broadcasting goes through /api/wallet/broadcast-btc to avoid CORS issues.

import * as bip39 from "bip39"
import { HDKey } from "@scure/bip32"
import { secp256k1 } from "@noble/curves/secp256k1.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { ripemd160 } from "@noble/hashes/legacy.js"
import { bech32 } from "bech32"

// ── Constants ────────────────────────────────────────────────────────────────

export const SATS_PER_BTC = 100_000_000
/** Dust threshold for P2WPKH outputs (sats). Below this, output is omitted. */
const DUST_THRESHOLD = 546n

export interface BitcoinUTXO {
  txid: string
  vout: number
  value: number  // satoshis
  status: { confirmed: boolean }
}

// ── Byte utilities ────────────────────────────────────────────────────────────

function concat(...arrays: Uint8Array[]): Uint8Array {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

function u32le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff])
}

function u64le(n: bigint): Uint8Array {
  const out = new Uint8Array(8)
  let v = n
  for (let i = 0; i < 8; i++) { out[i] = Number(v & 0xffn); v >>= 8n }
  return out
}

function varint(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n])
  if (n <= 0xffff) return new Uint8Array([0xfd, n & 0xff, (n >> 8) & 0xff])
  throw new Error(`varint overflow: ${n}`)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Double SHA-256. */
function dsha256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data))
}

/** Reverse a byte array in-place copy. */
function reversed(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes).reverse()
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

function hash160(pubKey: Uint8Array): Uint8Array {
  return ripemd160(sha256(pubKey))
}

/** P2WPKH scriptPubKey: OP_0 OP_PUSHBYTES_20 <pubKeyHash> */
function p2wpkhScript(pubKeyHash: Uint8Array): Uint8Array {
  return new Uint8Array([0x00, 0x14, ...pubKeyHash])
}

/** Decode a bech32 bc1... address to the 20-byte witness program. */
function bech32ToPubKeyHash(address: string): Uint8Array {
  const { words } = bech32.decode(address)
  // words[0] = witness version (0 for P2WPKH); rest is 5-bit encoded pubKeyHash
  const bytes = bech32.fromWords(words.slice(1))
  if (bytes.length !== 20) throw new Error("Invalid bech32 address: expected 20-byte program")
  return new Uint8Array(bytes)
}

// ── BIP-143 sighash ───────────────────────────────────────────────────────────

function bip143Sighash(
  inputs: BitcoinUTXO[],
  inputIndex: number,
  pubKeyHash: Uint8Array,
  outputs: { value: bigint; script: Uint8Array }[],
): Uint8Array {
  // hashPrevouts = dSHA256(all outpoints concatenated)
  const prevouts = concat(...inputs.map((u) => concat(reversed(hexToBytes(u.txid)), u32le(u.vout))))
  const hashPrevouts = dsha256(prevouts)

  // hashSequence = dSHA256(all sequences concatenated)
  const seqs = concat(...inputs.map(() => new Uint8Array([0xff, 0xff, 0xff, 0xff])))
  const hashSequence = dsha256(seqs)

  // hashOutputs = dSHA256(all outputs concatenated: value + scriptLen + script)
  const outs = concat(...outputs.map((o) => concat(u64le(o.value), varint(o.script.length), o.script)))
  const hashOutputs = dsha256(outs)

  const input = inputs[inputIndex]

  // scriptCode for P2WPKH input: varint(25) || OP_DUP OP_HASH160 PUSH20 <hash> OP_EQUALVERIFY OP_CHECKSIG
  const scriptCode = new Uint8Array([0x19, 0x76, 0xa9, 0x14, ...pubKeyHash, 0x88, 0xac])

  const preimage = concat(
    u32le(2),                                    // nVersion
    hashPrevouts,                                // hashPrevouts
    hashSequence,                                // hashSequence
    reversed(hexToBytes(input.txid)),            // outpoint txid (LE)
    u32le(input.vout),                           // outpoint vout
    scriptCode,                                  // scriptCode
    u64le(BigInt(input.value)),                  // input value
    new Uint8Array([0xff, 0xff, 0xff, 0xff]),    // nSequence
    hashOutputs,                                 // hashOutputs
    u32le(0),                                    // nLocktime
    u32le(1),                                    // SIGHASH_ALL
  )

  return dsha256(preimage)
}

// ── Transaction serialization ─────────────────────────────────────────────────

function serializeSegwitTx(
  inputs: BitcoinUTXO[],
  outputs: { value: bigint; script: Uint8Array }[],
  signatures: Uint8Array[],
  pubKey: Uint8Array,
): string {
  const parts: Uint8Array[] = [
    u32le(2),                      // version 2
    new Uint8Array([0x00, 0x01]),  // segwit marker + flag
    varint(inputs.length),
    // inputs (empty scriptSig - segwit spending)
    ...inputs.map((u) => concat(
      reversed(hexToBytes(u.txid)),
      u32le(u.vout),
      new Uint8Array([0x00]),                    // scriptLen = 0
      new Uint8Array([0xff, 0xff, 0xff, 0xff]),  // sequence
    )),
    varint(outputs.length),
    // outputs
    ...outputs.map((o) => concat(
      u64le(o.value),
      varint(o.script.length),
      o.script,
    )),
    // witnesses (one per input)
    ...signatures.map((sig) => concat(
      new Uint8Array([0x02]),        // 2 witness items
      varint(sig.length),            // sig length
      sig,                           // DER sig + SIGHASH_ALL
      new Uint8Array([0x21]),        // pubkey length = 33
      pubKey,                        // compressed pubkey
    )),
    u32le(0),                        // locktime
  ]
  return bytesToHex(concat(...parts))
}

// ── Key derivation ────────────────────────────────────────────────────────────

/** Returns the secp256k1 private + compressed public key for BTC (m/84'/0'/0'/0/0). */
async function deriveBitcoinKey(mnemonic: string): Promise<{
  privKey: Uint8Array
  pubKey: Uint8Array    // 33 bytes, compressed
  pubKeyHash: Uint8Array // 20 bytes, hash160
}> {
  const seed = await bip39.mnemonicToSeed(mnemonic)
  const master = HDKey.fromMasterSeed(new Uint8Array(seed))
  const child = master.derive("m/84'/0'/0'/0/0")

  if (!child.privateKey || !child.publicKey) {
    throw new Error("Failed to derive Bitcoin key")
  }

  return {
    privKey: child.privateKey,
    pubKey: child.publicKey,
    pubKeyHash: hash160(child.publicKey),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Estimated fee in satoshis for N inputs at the given fee rate (sats/vbyte). */
export function estimateBtcFee(numInputs = 1, feeRateSatPerVbyte = 5): bigint {
  // P2WPKH input: ~68 vbytes; P2WPKH output: ~31 vbytes; overhead: 10.5
  const vbytes = Math.ceil(10.5 + 68 * numInputs + 31 * 2)
  return BigInt(vbytes * feeRateSatPerVbyte)
}

/** Fetches confirmed UTXOs for a Bitcoin address via the server proxy. */
export async function fetchBitcoinUTXOs(address: string): Promise<BitcoinUTXO[]> {
  const { apiFetch } = await import("@/lib/api-fetch")
  const res = await apiFetch(`/api/wallet/utxos?address=${encodeURIComponent(address)}`)
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || "Failed to fetch UTXOs")
  return (data.utxos as BitcoinUTXO[]).filter((u) => u.status.confirmed)
}

/**
 * Builds, signs, and serializes a native SegWit (P2WPKH) Bitcoin transaction.
 * Returns a hex-encoded transaction ready to broadcast.
 */
export async function buildAndSignBitcoinTransfer(params: {
  mnemonic: string
  toAddress: string
  satoshis: bigint
  fromAddress: string
  feeRateSatPerVbyte?: number
}): Promise<{ hex: string }> {
  const { mnemonic, toAddress, satoshis, fromAddress, feeRateSatPerVbyte = 5 } = params

  const { privKey, pubKey, pubKeyHash } = await deriveBitcoinKey(mnemonic)

  // Fetch confirmed UTXOs
  const allUtxos = await fetchBitcoinUTXOs(fromAddress)
  if (allUtxos.length === 0) throw new Error("No confirmed UTXOs available")

  // Greedy coin selection (largest-first)
  const sorted = [...allUtxos].sort((a, b) => b.value - a.value)
  const selected: BitcoinUTXO[] = []
  let totalIn = 0n

  for (const utxo of sorted) {
    selected.push(utxo)
    totalIn += BigInt(utxo.value)
    const fee = estimateBtcFee(selected.length, feeRateSatPerVbyte)
    if (totalIn >= satoshis + fee) break
  }

  const fee = estimateBtcFee(selected.length, feeRateSatPerVbyte)
  if (totalIn < satoshis + fee) {
    throw new Error(
      `Insufficient balance: have ${totalIn} sats, need ${satoshis + fee} sats (incl. fee)`
    )
  }

  let changeAmount = totalIn - satoshis - fee

  // Build outputs
  const recipientPubKeyHash = bech32ToPubKeyHash(toAddress)
  const outputs: { value: bigint; script: Uint8Array }[] = [
    { value: satoshis, script: p2wpkhScript(recipientPubKeyHash) },
  ]
  if (changeAmount >= DUST_THRESHOLD) {
    outputs.push({ value: changeAmount, script: p2wpkhScript(pubKeyHash) })
  } else {
    // Sub-dust change is absorbed into the miner fee (no change output needed).
    // Recalculate fee for 1-output tx so the fee estimate is accurate.
    const singleOutputVbytes = BigInt(Math.ceil(10.5 + 68 * selected.length + 31))
    const minFee = singleOutputVbytes * BigInt(feeRateSatPerVbyte)
    changeAmount = 0n
    // Actual fee is totalIn - satoshis (all excess goes to miner)
    if (totalIn - satoshis < minFee) {
      throw new Error(`Insufficient balance after fees`)
    }
  }

  // Sign each input using BIP-143 sighash
  const signatures: Uint8Array[] = []
  for (let i = 0; i < selected.length; i++) {
    const hash = bip143Sighash(selected, i, pubKeyHash, outputs)
    const derBytes = secp256k1.sign(hash, privKey, { lowS: true, prehash: false, format: "der" })
    // Append SIGHASH_ALL byte
    const sigWithType = new Uint8Array(derBytes.length + 1)
    sigWithType.set(derBytes)
    sigWithType[derBytes.length] = 0x01
    signatures.push(sigWithType)
  }

  const hex = serializeSegwitTx(selected, outputs, signatures, pubKey)
  return { hex }
}

/** Broadcasts a hex-encoded Bitcoin transaction via the server proxy. */
export async function broadcastBitcoinTransaction(hex: string, recipientAddress?: string, senderAddress?: string): Promise<string> {
  const { apiFetch } = await import("@/lib/api-fetch")
  const res = await apiFetch("/api/wallet/broadcast-btc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx: hex, recipientAddress, senderAddress }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || "BTC broadcast failed")
  return data.txid as string
}
