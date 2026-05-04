"use client"

// Client-side Ethereum ETH transfer: derive wallet from mnemonic, build + sign EIP-1559 transaction.
// Uses ethers v6 for key derivation and transaction signing.
// Broadcasting goes through /api/wallet/broadcast-eth to avoid CORS issues.

import { Wallet } from "ethers"

// ── Constants ────────────────────────────────────────────────────────────────

/** Gas limit for a simple ETH transfer. */
export const ETH_GAS_LIMIT = 21_000n

// ── Types ────────────────────────────────────────────────────────────────────

export interface EthTxParams {
  nonce: number
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  chainId: number
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the ETH transaction parameters (nonce + EIP-1559 fees) from the server proxy.
 * These must be fetched fresh before each transaction - nonce and gas prices change frequently.
 */
export async function getEthTxParams(fromAddress: string): Promise<EthTxParams> {
  const res = await fetch(
    `/api/wallet/eth-tx-params?address=${encodeURIComponent(fromAddress)}`
  )
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || "Failed to fetch ETH tx params")
  return {
    nonce: data.nonce,
    maxFeePerGas: BigInt(data.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(data.maxPriorityFeePerGas),
    chainId: data.chainId,
  }
}

/**
 * Builds and signs an EIP-1559 ETH transfer using ethers v6.
 * Returns a hex-encoded signed transaction ready to broadcast.
 */
export async function buildAndSignEthTransfer(params: {
  mnemonic: string
  toAddress: string
  valueWei: bigint
  nonce: number
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  chainId: number
}): Promise<{ signedHex: string }> {
  const { mnemonic, toAddress, valueWei, nonce, maxFeePerGas, maxPriorityFeePerGas, chainId } =
    params

  // Derive Ethereum wallet - default path is m/44'/60'/0'/0/0
  const wallet = Wallet.fromPhrase(mnemonic)

  const signedHex = await wallet.signTransaction({
    to: toAddress,
    value: valueWei,
    nonce,
    chainId: BigInt(chainId),
    type: 2,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasLimit: ETH_GAS_LIMIT,
    data: "0x",
  })

  return { signedHex }
}

/** Broadcasts a signed Ethereum transaction via the server proxy. Returns the tx hash. */
export async function broadcastEthTransaction(signedHex: string, recipientAddress?: string, senderAddress?: string): Promise<string> {
  const { apiFetch } = await import("@/lib/api-fetch")
  const res = await apiFetch("/api/wallet/broadcast-eth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx: signedHex, recipientAddress, senderAddress }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || "ETH broadcast failed")
  return data.hash as string
}
