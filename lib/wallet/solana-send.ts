"use client"

// Client-side Solana transfers: derive keypair, build and sign raw legacy transactions.
// Supports both native SOL transfers and SPL-token (USDC) transfers.
// Uses only existing dependencies (bip39, ed25519-hd-key, tweetnacl, bs58, buffer,
// @noble/hashes, @noble/curves). Broadcasting goes through /api/wallet/broadcast to
// avoid CORS / rate-limit issues.

import * as bip39 from "bip39"
import { derivePath } from "ed25519-hd-key"
import nacl from "tweetnacl"
import bs58 from "bs58"
import { Buffer } from "buffer"
import { sha256 } from "@noble/hashes/sha2.js"
import { ed25519 } from "@noble/curves/ed25519.js"

// ── Constants ────────────────────────────────────────────────────────────────

export const LAMPORTS_PER_SOL = 1_000_000_000
export const SOL_FEE_LAMPORTS = 5000n   // typical fee for a 1-sig transfer

/** SPL token mint for USDC on Solana mainnet (Circle canonical). */
export const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

/** USDC SPL decimals -matches Circle's declared precision. */
export const USDC_DECIMALS = 6

/** System Program address -32 zero bytes (bs58: 11111111111111111111111111111111) */
const SYSTEM_PROGRAM = new Uint8Array(32)

/** SPL Token Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA */
const SPL_TOKEN_PROGRAM_ID = bs58.decode("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

/** Associated Token Account Program: ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL */
const ASSOCIATED_TOKEN_PROGRAM_ID = bs58.decode("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

// ── Byte utilities ────────────────────────────────────────────────────────────

/** Concatenate Uint8Arrays without spread -avoids prototype issues. */
function concat(...arrays: Uint8Array[]): Uint8Array {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

/** uint32 little-endian, 4 bytes. */
function u32le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff])
}

/** uint64 little-endian, 8 bytes. Accepts bigint. */
function u64le(n: bigint): Uint8Array {
  const out = new Uint8Array(8)
  let v = n
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

/** Solana compact-u16 (values 0-127: single byte; 128-16383: two bytes). */
function cu16(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n])
  if (n < 0x4000) return new Uint8Array([(n & 0x7f) | 0x80, n >> 7])
  throw new Error(`compact-u16 overflow: ${n}`)
}

// ── Key derivation ───────────────────────────────────────────────────────────

/** Derives the Solana Ed25519 keypair from a BIP-39 mnemonic (path m/44'/501'/0'). */
export async function getSolanaKeypair(mnemonic: string): Promise<{
  publicKey: Uint8Array   // 32 bytes
  secretKey: Uint8Array   // 64 bytes: seed || pubkey
}> {
  const seed = await bip39.mnemonicToSeed(mnemonic)          // 64 bytes
  const seedHex = Array.from(new Uint8Array(seed)).map(b => b.toString(16).padStart(2, "0")).join("")
  const { key } = derivePath("m/44'/501'/0'", seedHex)
  return nacl.sign.keyPair.fromSeed(new Uint8Array(key))                      // key is 32-byte seed
}

// ── Transaction building ──────────────────────────────────────────────────────

function buildMessage(
  from: Uint8Array,      // 32 bytes -sender (signer, writable, index 0)
  to: Uint8Array,        // 32 bytes -recipient (non-signer, writable, index 1)
  lamports: bigint,
  blockhash: Uint8Array, // 32 bytes
): Uint8Array {
  // SystemProgram.transfer instruction data: [enum=2 u32le][amount u64le]  (12 bytes)
  const instructionData = concat(u32le(2), u64le(lamports))

  // Compiled instruction layout:
  //   [program_id_index u8][account_count cu16][account_indices u8…][data_len cu16][data…]
  const instruction = concat(
    new Uint8Array([2]),          // program_id_index = 2 (SYSTEM_PROGRAM is at index 2)
    cu16(2),                      // 2 account indices follow
    new Uint8Array([0, 1]),       // from=0, to=1
    cu16(instructionData.length), // data length = 12
    instructionData,
  )

  // Legacy message layout:
  //   [header 3 bytes][account_count cu16][accounts…][blockhash 32 bytes]
  //   [instruction_count cu16][instructions…]
  return concat(
    new Uint8Array([1, 0, 1]),    // header: 1 req-sig, 0 readonly-signed, 1 readonly-unsigned
    cu16(3),                      // 3 account keys
    from,                         // index 0: sender -writable signer
    to,                           // index 1: recipient -writable non-signer
    SYSTEM_PROGRAM,               // index 2: system program -readonly non-signer
    blockhash,
    cu16(1),                      // 1 instruction
    instruction,
  )
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Signs and serializes a SOL transfer transaction ready to broadcast.
 * Returns the base64 string (for /api/wallet/broadcast) and the raw bytes.
 */
export async function buildAndSignTransfer(params: {
  mnemonic: string
  toAddress: string
  lamports: bigint
  recentBlockhash: string
}): Promise<{ base64: string; bytes: Uint8Array }> {
  const { mnemonic, toAddress, lamports, recentBlockhash } = params

  const keypair  = await getSolanaKeypair(mnemonic)
  const to       = bs58.decode(toAddress)
  const blockhash = bs58.decode(recentBlockhash)

  if (to.length !== 32) throw new Error("Invalid recipient address (not 32 bytes)")
  if (blockhash.length !== 32) throw new Error("Invalid blockhash (not 32 bytes)")

  const message   = buildMessage(keypair.publicKey, to, lamports, blockhash)
  const signature = nacl.sign.detached(message, keypair.secretKey)

  // Signed legacy transaction: [sig_count cu16][signature 64 bytes][message]
  const bytes = concat(cu16(1), signature, message)
  const base64 = Buffer.from(bytes).toString("base64")

  return { base64, bytes }
}

/**
 * Signs and serializes a split SOL transfer: two outputs in one atomic tx.
 * Used for platform fee collection (e.g. 97% to creator, 3% to platform).
 */
// Disabled until multi-instruction format is verified on devnet.
// Re-export when ready to enable platform fee split.
async function _buildAndSignSplitTransfer(params: {
  mnemonic: string
  toAddress: string
  platformAddress: string
  creatorLamports: bigint
  platformLamports: bigint
  recentBlockhash: string
}): Promise<{ base64: string; bytes: Uint8Array }> {
  const { mnemonic, toAddress, platformAddress, creatorLamports, platformLamports, recentBlockhash } = params

  const keypair   = await getSolanaKeypair(mnemonic)
  const to        = bs58.decode(toAddress)
  const platform  = bs58.decode(platformAddress)
  const blockhash = bs58.decode(recentBlockhash)

  if (to.length !== 32) throw new Error("Invalid creator address (not 32 bytes)")
  if (platform.length !== 32) throw new Error("Invalid platform address (not 32 bytes)")
  if (blockhash.length !== 32) throw new Error("Invalid blockhash (not 32 bytes)")

  const message = buildSplitMessage(keypair.publicKey, to, platform, creatorLamports, platformLamports, blockhash)
  const signature = nacl.sign.detached(message, keypair.secretKey)

  const bytes = concat(cu16(1), signature, message)
  const base64 = Buffer.from(bytes).toString("base64")

  return { base64, bytes }
}

/**
 * Builds a legacy message with two System.transfer instructions.
 * Account layout: [sender(0), creator(1), platform(2), system(3)]
 */
function buildSplitMessage(
  from: Uint8Array,
  creator: Uint8Array,
  platform: Uint8Array,
  creatorLamports: bigint,
  platformLamports: bigint,
  blockhash: Uint8Array,
): Uint8Array {
  // Instruction 1: sender → creator
  const data1 = concat(u32le(2), u64le(creatorLamports))
  const ix1 = concat(
    new Uint8Array([3]),          // program_id_index = 3 (SYSTEM_PROGRAM at index 3)
    cu16(2),                      // 2 account indices
    new Uint8Array([0, 1]),       // from=0, to=1 (creator)
    cu16(data1.length),
    data1,
  )

  // Instruction 2: sender → platform
  const data2 = concat(u32le(2), u64le(platformLamports))
  const ix2 = concat(
    new Uint8Array([3]),          // program_id_index = 3
    cu16(2),                      // 2 account indices
    new Uint8Array([0, 2]),       // from=0, to=2 (platform)
    cu16(data2.length),
    data2,
  )

  // Legacy message: header + 4 accounts + blockhash + 2 instructions
  return concat(
    new Uint8Array([1, 0, 1]),    // header: 1 signer, 0 readonly-signed, 1 readonly-unsigned (system)
    cu16(4),                      // 4 account keys
    from,                         // index 0: sender -writable signer
    creator,                      // index 1: creator -writable non-signer
    platform,                     // index 2: platform -writable non-signer
    SYSTEM_PROGRAM,               // index 3: system program -readonly non-signer
    blockhash,
    cu16(2),                      // 2 instructions
    ix1,
    ix2,
  )
}

/** Broadcasts via the server-side proxy route (uses Alchemy if available). */
export async function broadcastTransaction(base64Tx: string, recipientAddress?: string, senderAddress?: string): Promise<string> {
  const { apiFetch } = await import("@/lib/api-fetch")
  const res = await apiFetch("/api/wallet/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx: base64Tx, recipientAddress, senderAddress }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || "Broadcast failed")
  return data.signature as string
}

/** Fetches the latest confirmed blockhash via the server broadcast route's RPC.
 *  Falls back to public endpoints if the server route isn't available. */
export async function getLatestBlockhash(): Promise<string> {
  // Try the server-side route first to avoid CORS issues
  try {
    const res = await fetch("/api/wallet/blockhash")
    if (res.ok) {
      const data = await res.json()
      if (data.blockhash) return data.blockhash
    }
  } catch { /* fall through */ }

  // Direct public RPC fallback
  const rpcs = [
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana",
  ]
  for (const url of rpcs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getLatestBlockhash",
          params: [{ commitment: "confirmed" }],
        }),
      })
      const data = await res.json()
      if (data.result?.value?.blockhash) return data.result.value.blockhash
    } catch { continue }
  }
  throw new Error("Could not fetch recent blockhash")
}

/** Validates a Solana address: base58-encoded public key (exactly 32 bytes). */
export function isValidSolanaAddress(addr: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) return false
  try {
    return bs58.decode(addr).length === 32
  } catch {
    return false
  }
}

/** Detects which chain a raw address belongs to. Returns null if unrecognised. */
export function detectAddressChain(addr: string): "bitcoin" | "ethereum" | "solana" | null {
  if (isValidSolanaAddress(addr)) return "solana"
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr)) return "bitcoin"
  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) return "ethereum"
  return null
}

/** Returns true if the input looks like a nimimo handle (e.g. chris, cool-water, @word-word). */
export function isNimimoHandle(input: string): boolean {
  const clean = input.startsWith("@") ? input.slice(1) : input
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/i.test(clean)
}

// ── SPL token (USDC) send ────────────────────────────────────────────────────

/**
 * Ed25519 on-curve check. A Solana program-derived address (PDA) must NOT
 * correspond to a valid ed25519 public key, so we iterate bump bytes until
 * the derivation lands off-curve.
 */
function isOnCurve(bytes: Uint8Array): boolean {
  try {
    ed25519.Point.fromBytes(bytes)
    return true
  } catch {
    return false
  }
}

/** Solana's `findProgramAddress`: iterate bump from 255 downward, return the
 *  first derivation that lands off the ed25519 curve. */
function findProgramAddress(
  seeds: Uint8Array[],
  programId: Uint8Array,
): { address: Uint8Array; bump: number } {
  const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress")
  for (let bump = 255; bump >= 0; bump--) {
    const buf = concat(...seeds, new Uint8Array([bump]), programId, PDA_MARKER)
    const hash = sha256(buf)
    if (!isOnCurve(hash)) return { address: hash, bump }
  }
  throw new Error("Unable to find a PDA -all bumps landed on curve")
}

/**
 * Derive the Associated Token Account (ATA) for a given owner + mint under
 * the SPL Token Program. This is the canonical token account -SPL balances
 * live here rather than on the wallet address itself.
 */
export function findAssociatedTokenAccount(owner: Uint8Array, mint: Uint8Array): Uint8Array {
  if (owner.length !== 32) throw new Error("Owner pubkey must be 32 bytes")
  if (mint.length !== 32) throw new Error("Mint pubkey must be 32 bytes")
  return findProgramAddress([owner, SPL_TOKEN_PROGRAM_ID, mint], ASSOCIATED_TOKEN_PROGRAM_ID).address
}

/** Convenience wrapper that takes and returns base58 strings. */
export function findAssociatedTokenAccountBase58(owner: string, mint: string): string {
  const ata = findAssociatedTokenAccount(bs58.decode(owner), bs58.decode(mint))
  return bs58.encode(ata)
}

/**
 * Convert a human-readable token amount ("10.5") to raw base units as a
 * bigint, scaled by `decimals`. Rejects values with too much precision.
 */
export function tokenAmountToRawUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid token amount: ${amount}`)
  const [whole, frac = ""] = trimmed.split(".")
  if (frac.length > decimals) throw new Error(`Token amount exceeds ${decimals} decimal places`)
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals)
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0")
}

/**
 * Build the legacy message for an SPL-token transfer. We always include the
 * idempotent AssociatedTokenAccount creation instruction so first-send to a
 * recipient without an ATA succeeds in a single round-trip. If the recipient
 * already has an ATA the idempotent create is a no-op (no rent charged).
 *
 * Account layout:
 *   [0] sender wallet   -writable signer, fee payer + ATA authority
 *   [1] sender ATA      -writable non-signer, source token account
 *   [2] recipient ATA   -writable non-signer, destination (may be newly created)
 *   [3] recipient wallet -readonly non-signer, future owner of recipient ATA
 *   [4] mint            -readonly non-signer
 *   [5] SPL token prog  -readonly non-signer
 *   [6] assoc ATA prog  -readonly non-signer
 *   [7] system program  -readonly non-signer
 */
function buildSplTransferMessage(
  sender: Uint8Array,
  recipient: Uint8Array,
  mint: Uint8Array,
  rawAmount: bigint,
  decimals: number,
  blockhash: Uint8Array,
): Uint8Array {
  const senderAta = findAssociatedTokenAccount(sender, mint)
  const recipientAta = findAssociatedTokenAccount(recipient, mint)

  // Instruction 1: createAssociatedTokenAccountIdempotent (opcode 1 on the ATA program).
  // Accounts in the ATA program's expected order:
  //   funder, ata, owner, mint, system, token
  const ataCreateIx = concat(
    new Uint8Array([6]),                 // program_id_index = ASSOCIATED_TOKEN_PROGRAM (key index 6)
    cu16(6),                             // 6 accounts
    new Uint8Array([0, 2, 3, 4, 7, 5]),  // funder, ata, owner, mint, system, token
    cu16(1),
    new Uint8Array([1]),                 // discriminator = 1 (Idempotent)
  )

  // Instruction 2: SPL Token `transferChecked` (opcode 12). Verifies the mint
  // and decimals match the source ATA, so we can't accidentally send the wrong
  // token or wrong amount precision.
  //   Accounts: source, mint, destination, authority
  const transferData = concat(new Uint8Array([12]), u64le(rawAmount), new Uint8Array([decimals]))
  const transferIx = concat(
    new Uint8Array([5]),                 // program_id_index = SPL_TOKEN_PROGRAM (key index 5)
    cu16(4),                             // 4 accounts
    new Uint8Array([1, 4, 2, 0]),        // source, mint, dest, authority
    cu16(transferData.length),
    transferData,
  )

  // Legacy message:
  //   [header 3 bytes][account_count cu16][accounts…][blockhash 32][ix_count cu16][ix…]
  // Header: 1 required signature, 0 readonly-signed, 5 readonly-unsigned (indices 3-7).
  return concat(
    new Uint8Array([1, 0, 5]),
    cu16(8),
    sender,                        // 0 -writable signer
    senderAta,                     // 1 -writable non-signer
    recipientAta,                  // 2 -writable non-signer
    recipient,                     // 3 -readonly non-signer
    mint,                          // 4 -readonly non-signer
    SPL_TOKEN_PROGRAM_ID,          // 5 -readonly non-signer
    ASSOCIATED_TOKEN_PROGRAM_ID,   // 6 -readonly non-signer
    SYSTEM_PROGRAM,                // 7 -readonly non-signer
    blockhash,
    cu16(2),
    ataCreateIx,
    transferIx,
  )
}

/**
 * Signs and serializes an SPL-token transfer transaction ready to broadcast.
 * Hand-rolled to avoid pulling in @solana/web3.js -uses the same primitives
 * as `buildAndSignTransfer`.
 */
export async function buildAndSignSplTransfer(params: {
  mnemonic: string
  toAddress: string
  mintAddress: string
  rawAmount: bigint
  decimals: number
  recentBlockhash: string
}): Promise<{ base64: string; bytes: Uint8Array }> {
  const { mnemonic, toAddress, mintAddress, rawAmount, decimals, recentBlockhash } = params

  const keypair = await getSolanaKeypair(mnemonic)
  const to = bs58.decode(toAddress)
  const mint = bs58.decode(mintAddress)
  const blockhash = bs58.decode(recentBlockhash)

  if (to.length !== 32) throw new Error("Invalid recipient address (not 32 bytes)")
  if (mint.length !== 32) throw new Error("Invalid mint address (not 32 bytes)")
  if (blockhash.length !== 32) throw new Error("Invalid blockhash (not 32 bytes)")
  if (rawAmount <= 0n) throw new Error("Transfer amount must be positive")

  const message = buildSplTransferMessage(keypair.publicKey, to, mint, rawAmount, decimals, blockhash)
  const signature = nacl.sign.detached(message, keypair.secretKey)

  const bytes = concat(cu16(1), signature, message)
  const base64 = Buffer.from(bytes).toString("base64")
  return { base64, bytes }
}

/**
 * Ask the network whether a given account exists. Used as a pre-flight check
 * so the send UI can disclose the ~0.002 SOL rent cost when the recipient's
 * USDC ATA needs to be created on first send.
 */
export async function solanaAccountExists(address: string): Promise<boolean> {
  const rpcs = ["/api/wallet/account-info"] // proxied, Alchemy-aware
  for (const url of rpcs) {
    try {
      const res = await fetch(`${url}?address=${encodeURIComponent(address)}`)
      if (!res.ok) continue
      const data = await res.json()
      return data?.exists === true
    } catch {
      continue
    }
  }
  // On total RPC failure, default to "assume it exists" so we don't falsely
  // warn the user about rent. Worst case they actually pay the 0.002 SOL and
  // the send still succeeds -no funds lost, no tx failure.
  return true
}

/**
 * Convenience: compute the recipient's USDC ATA address and check if it
 * exists. Returns { ata, exists }. The UI uses `exists === false` to show
 * a "will create recipient account (~0.002 SOL)" disclosure.
 */
export async function checkUsdcRecipientAta(recipient: string): Promise<{ ata: string; exists: boolean }> {
  const ata = findAssociatedTokenAccountBase58(recipient, USDC_MINT_ADDRESS)
  const exists = await solanaAccountExists(ata)
  return { ata, exists }
}
