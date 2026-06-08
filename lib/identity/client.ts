// Client-side identity management
import { generateHandle, generateHandleWithSuffix } from "./wordlists"
import { signLinkProof } from "./link-proof"
import { apiFetch } from "@/lib/api-fetch"

export interface Identity {
  identity_id: string
  handle: string
  status: string
  created_at: string
}

export interface AssignIdentityResult {
  handle: string
  ownership_id: string
  existed: boolean
}

export class IdentityClient {
  async assignIdentity(
    ownership_id: string,
    options?: { initial?: boolean; getMnemonic?: (ownership_id: string) => Promise<string> },
  ): Promise<AssignIdentityResult> {
    let attempts = 0
    const maxAttempts = 10

    // Seed-control proof for linking to an existing ownership. Fetched at
    // most once (on a proof_required response) and then reused across the
    // handle-collision retries below, since it's bound to the ownership and
    // nonce rather than the handle.
    let proof: { nonce: string; signature: string } | undefined
    let proofAttempted = false

    // First 3 attempts: try pure 2-word handles (65k namespace)
    // After that: add numeric suffix (65k x 900 = 59M namespace)
    while (attempts < maxAttempts) {
      attempts++
      const handle = attempts <= 3 ? generateHandle() : generateHandleWithSuffix()

      const response = await apiFetch("/api/identity/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownership_id,
          handle,
          ...(options?.initial ? { initial: true } : {}),
          ...(proof ?? {}),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        return {
          handle: data.handle,
          ownership_id: data.ownership_id ?? ownership_id,
          existed: data.existed === true,
        }
      }

      if (response.status === 409) {
        // Collision, retry with new handle
        continue
      }

      if (
        response.status === 403 &&
        data?.error === "proof_required" &&
        !proofAttempted &&
        options?.getMnemonic
      ) {
        // The ownership already has an identity and we aren't linked yet.
        // Prove control of the seed, then retry with the proof attached.
        proofAttempted = true
        proof = await this.fetchLinkProof(ownership_id, options.getMnemonic)
        attempts-- // the proof handshake shouldn't burn a handle attempt
        continue
      }

      throw new Error(data.error || "Identity assignment failed")
    }

    throw new Error("Failed to assign identity after maximum attempts")
  }

  /** Obtains a single-use challenge and signs it with the ownership's seed. */
  private async fetchLinkProof(
    ownership_id: string,
    getMnemonic: (ownership_id: string) => Promise<string>,
  ): Promise<{ nonce: string; signature: string }> {
    const response = await apiFetch("/api/identity/link-challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownership_id }),
    })
    if (!response.ok) {
      throw new Error("Failed to obtain link challenge")
    }
    const { nonce } = await response.json()
    const mnemonic = await getMnemonic(ownership_id)
    const signature = await signLinkProof(mnemonic, ownership_id, nonce)
    return { nonce, signature }
  }

  async getIdentity(ownership_id: string): Promise<Identity | null> {
    const response = await apiFetch(`/api/identity/by-ownership/${ownership_id}`)

    if (response.status === 404) {
      return null
    }

    if (response.status === 403) {
      // Ownership not linked to this user yet - treat as "no identity"
      return null
    }

    if (!response.ok) {
      throw new Error("Failed to fetch identity")
    }

    return await response.json()
  }
}
