// Isomorphic helpers for the multi-device identity link step.
//
// Linking an account to an ownership that already has an identity requires
// proof that the caller controls that ownership's seed. The seed never
// leaves the device: the client signs a message over public data (the
// ownership_id plus a single-use server nonce) and the server only recovers
// the signer address and compares it against a stored public address.

import { HDNodeWallet, verifyMessage } from "ethers"

/** Derivation path the public `ethereum` address is stored under (BIP-44). */
export const ETH_LINK_PATH = "m/44'/60'/0'/0/0"

/** Canonical message bound to a specific ownership + single-use nonce. */
export function buildLinkMessage(ownership_id: string, nonce: string): string {
  return `nimimo-link:v1:${ownership_id}:${nonce}`
}

/**
 * Client-side: sign the link message with the seed's Ethereum key.
 * Must run on the device that holds the mnemonic.
 */
export async function signLinkProof(
  mnemonic: string,
  ownership_id: string,
  nonce: string,
): Promise<string> {
  const wallet = HDNodeWallet.fromPhrase(mnemonic, "", ETH_LINK_PATH)
  return wallet.signMessage(buildLinkMessage(ownership_id, nonce))
}

/**
 * Server-side: recover the address that produced `signature` over the
 * canonical message, or null when the signature is malformed.
 */
export function recoverLinkSigner(
  ownership_id: string,
  nonce: string,
  signature: string,
): string | null {
  try {
    return verifyMessage(buildLinkMessage(ownership_id, nonce), signature)
  } catch {
    return null
  }
}
