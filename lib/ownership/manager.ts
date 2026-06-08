// Ownership manager - orchestrates the ownership layer

import { OwnershipDB, type OwnershipRecord, type AccessBinding } from "./indexeddb"
import { generateSecureSeed, encryptSeed, decryptSeed, generateOwnershipId } from "./crypto"
import { IdentityClient } from "../identity/client"
import { migrateAllOwnerships } from "./migration"
import { logger } from "../logger"

const log = logger("ownership")

export class OwnershipManager {
  public db: OwnershipDB
  private identityClient: IdentityClient

  constructor() {
    this.db = new OwnershipDB()
    this.identityClient = new IdentityClient()
  }

  async initialize(): Promise<void> {
    await this.db.init()

    try {
      const db = (this.db as unknown as { db: IDBDatabase }).db
      if (db) {
        await migrateAllOwnerships(db)
      }
    } catch (_error) {
      log.warn("Migration error (non-fatal)", { error: _error })
    }
  }

  async resolveOwnership(access_id: string): Promise<{
    hasOwnership: boolean
    ownership_id?: string
    isNewAccount: boolean
    localOwnerships: OwnershipRecord[]
    cryptoUpgrade?: { from: string; to: string }
  }> {
    // STEP 1: Check for existing binding
    const binding = await this.db.getAccessBinding(access_id)

    if (binding && binding.ownership_ids.length > 0) {
      const activeOwnershipId = binding.activeOwnershipId || binding.ownership_ids[0]

      const ownership = await this.db.getOwnership(activeOwnershipId)

      if (!ownership) {

        // Remove the orphaned ownership from the array
        const cleanedIds = binding.ownership_ids.filter((id) => id !== activeOwnershipId)

        if (cleanedIds.length === 0) {
          // No valid ownerships left, delete the binding
          await this.db.deleteAccessBinding(access_id)
        } else {
          // Update with cleaned list
          binding.ownership_ids = cleanedIds
          binding.activeOwnershipId = cleanedIds[0]
          await this.db.createAccessBinding(binding)
        }

        // Continue to STEP 2
      } else {
        await this.db.updateLastUsed(access_id)

        // Decrypt and verify seed (mnemonic)
        try {
          await decryptSeed(ownership.encryptedSeed, ownership.iv, ownership.ownership_id)
        } catch {
          // Decryption failed - stale data encrypted with old key derivation
          const oldVersion = ownership.crypto?.version || "v1"
          log.warn("Stale ownership detected, cleaning up", { ownership_id: activeOwnershipId, crypto_version: oldVersion })
          await this.db.deleteOwnershipAndUpdateBinding([activeOwnershipId], access_id)

          const localOwnerships = await this.db.getAllOwnerships()
          return {
            hasOwnership: false,
            isNewAccount: localOwnerships.length === 0,
            localOwnerships,
            cryptoUpgrade: { from: oldVersion, to: "v2" },
          }
        }

        return {
          hasOwnership: true,
          ownership_id: activeOwnershipId,
          isNewAccount: false,
          localOwnerships: [],
        }
      }
    }

    const allOwnerships = await this.db.getAllOwnerships()

    // Filter out stale ownerships that can't be decrypted (e.g. old crypto version)
    const validOwnerships: OwnershipRecord[] = []
    let didUpgrade = false
    for (const ownership of allOwnerships) {
      try {
        await decryptSeed(ownership.encryptedSeed, ownership.iv, ownership.ownership_id)
        validOwnerships.push(ownership)
      } catch {
        log.warn("Removing undecryptable ownership from local list", { ownership_id: ownership.ownership_id, crypto_version: ownership.crypto?.version })
        await this.db.deleteOwnership(ownership.ownership_id)
        didUpgrade = true
      }
    }

    return {
      hasOwnership: false,
      isNewAccount: validOwnerships.length === 0,
      localOwnerships: validOwnerships,
      ...(didUpgrade ? { cryptoUpgrade: { from: "v1", to: "v2" } } : {}),
    }
  }

  async createOwnership(access_id: string, options?: { initial?: boolean }): Promise<string> {
    // Step 1: Generate BIP-39 mnemonic
    const mnemonic = await generateSecureSeed()

    // Step 2: Generate ownership ID (cryptographically secure UUID)
    const ownership_id = generateOwnershipId()

    // Step 3: Encrypt MNEMONIC with device-bound key
    const { encryptedSeed, iv } = await encryptSeed(mnemonic, ownership_id)

    const ownership: OwnershipRecord = {
      ownership_id,
      encryptedSeed,
      iv,
      crypto: {
        version: "v2",
        kdf: "device-bound",
      },
      createdAt: Date.now(),
      recovery: {
        state: "none",
        method: null,
        lastCreatedAt: null,
        lastVerifiedAt: null,
      },
      protection: "device",
      version: "v2",
    }

    // Step 5: Save to IndexedDB
    await this.db.saveOwnership(ownership)

    // Step 6: Assign identity
    //
    // The server enforces "at most one ownership per user" via an atomic
    // compare-and-swap on users.has_identity inside /api/identity/assign.
    // If we lose the race (e.g. another tab or device submitted first),
    // the server returns { existed: true } pointing to the canonical
    // ownership_id. In that case we discard our freshly-generated local
    // orphan and continue with the server's canonical id.
    let canonicalOwnershipId = ownership_id
    try {
      const result = await this.identityClient.assignIdentity(ownership_id, {
        initial: options?.initial === true,
        getMnemonic: (id) => this.getMnemonic(id),
      })
      if (result.existed && result.ownership_id !== ownership_id) {
        log.warn("Identity assign lost race - reconciling to server's canonical ownership", {
          local: ownership_id,
          canonical: result.ownership_id,
        })
        await this.db.deleteOwnership(ownership_id)
        canonicalOwnershipId = result.ownership_id
      }
    } catch {
      // Clean up the ownership since identity assignment failed
      await this.db.deleteOwnership(ownership_id)
      throw new Error("Failed to assign identity to ownership")
    }

    // Step 7: Create access binding
    const existingBinding = await this.db.getAccessBinding(access_id)

    const binding: AccessBinding = existingBinding
      ? {
          ...existingBinding,
          ownership_ids: existingBinding.ownership_ids.includes(canonicalOwnershipId)
            ? existingBinding.ownership_ids
            : [...existingBinding.ownership_ids, canonicalOwnershipId],
          activeOwnershipId: canonicalOwnershipId,
          lastUsedAt: Date.now(),
        }
      : {
          access_id,
          ownership_ids: [canonicalOwnershipId],
          activeOwnershipId: canonicalOwnershipId,
          boundAt: Date.now(),
          lastUsedAt: Date.now(),
        }

    await this.db.createAccessBinding(binding)

    return canonicalOwnershipId
  }

  async bindExistingOwnership(access_id: string, ownership_id: string): Promise<void> {
    const existingBinding = await this.db.getAccessBinding(access_id)

    const binding: AccessBinding = existingBinding
      ? {
          ...existingBinding,
          ownership_ids: existingBinding.ownership_ids.includes(ownership_id)
            ? existingBinding.ownership_ids
            : [...existingBinding.ownership_ids, ownership_id],
          activeOwnershipId: ownership_id,
          lastUsedAt: Date.now(),
        }
      : {
          access_id,
          ownership_ids: [ownership_id],
          activeOwnershipId: ownership_id,
          boundAt: Date.now(),
          lastUsedAt: Date.now(),
        }

    await this.db.createAccessBinding(binding)
  }

  async bindMultipleOwnerships(access_id: string, ownership_ids: string[]): Promise<void> {
    const existingBinding = await this.db.getAccessBinding(access_id)

    const uniqueIds = existingBinding
      ? [...new Set([...existingBinding.ownership_ids, ...ownership_ids])]
      : ownership_ids

    const binding: AccessBinding = {
      access_id,
      ownership_ids: uniqueIds,
      activeOwnershipId: ownership_ids[0], // Set first selected as active
      boundAt: existingBinding?.boundAt || Date.now(),
      lastUsedAt: Date.now(),
    }

    await this.db.createAccessBinding(binding)
  }

  async getBoundOwnerships(access_id: string): Promise<OwnershipRecord[]> {
    const binding = await this.db.getAccessBinding(access_id)
    if (!binding || binding.ownership_ids.length === 0) {
      return []
    }

    const ownerships: OwnershipRecord[] = []
    for (const ownership_id of binding.ownership_ids) {
      const ownership = await this.db.getOwnership(ownership_id)
      if (ownership) {
        ownerships.push(ownership)
      }
    }

    return ownerships
  }

  async switchOwnership(access_id: string, ownership_id: string): Promise<void> {
    const binding = await this.db.getAccessBinding(access_id)
    if (!binding) {
      throw new Error("No binding found for this access_id")
    }

    if (!binding.ownership_ids.includes(ownership_id)) {
      throw new Error("This ownership is not bound to this access_id")
    }

    binding.activeOwnershipId = ownership_id
    binding.lastUsedAt = Date.now()

    await this.db.createAccessBinding(binding)
  }

  async getAllOwnerships(): Promise<OwnershipRecord[]> {
    return this.db.getAllOwnerships()
  }

  async getIdentity(ownership_id: string): Promise<string | null> {
    const identity = await this.identityClient.getIdentity(ownership_id)
    return identity?.handle || null
  }

  async assignIdentity(ownership_id: string): Promise<string> {
    const result = await this.identityClient.assignIdentity(ownership_id, {
      getMnemonic: (id) => this.getMnemonic(id),
    })
    return result.handle
  }

  /** Decrypts and returns the BIP-39 mnemonic for the given ownership.
   *  Must only be called from client-side code (requires IndexedDB + WebCrypto). */
  async getMnemonic(ownership_id: string): Promise<string> {
    const record = await this.db.getOwnership(ownership_id)
    if (!record) throw new Error("Ownership not found: " + ownership_id)
    return decryptSeed(record.encryptedSeed, record.iv, ownership_id)
  }
}
