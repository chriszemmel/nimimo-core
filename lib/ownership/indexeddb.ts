// IndexedDB management for ownership layer

const DB_NAME = "nimimo-ownership"
const DB_VERSION = 1

export interface OwnershipRecord {
  ownership_id: string
  encryptedSeed: string // base64 encoded encrypted MNEMONIC (not binary seed)
  iv: string // base64 encoded IV for AES-GCM
  crypto: {
    version: "v2"
    kdf: "device-bound" // KEK₁ - no PIN required
  }
  createdAt: number
  recovery: {
    state: "none" | "created" | "verified"
    method: null | "pin" | "password"
    lastCreatedAt: number | null
    lastVerifiedAt: number | null
  }
  protection: "device" | "recovery"
  version: "v1" | "v2"
  // Deprecated field for backward compatibility
  backedUp?: boolean
}

export interface AccessBinding {
  access_id: string
  ownership_ids: string[] // Array of ownership IDs bound to this access
  boundAt: number
  lastUsedAt: number
  activeOwnershipId?: string // The currently active ownership
}

export class OwnershipDB {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains("ownerships")) {
          db.createObjectStore("ownerships", { keyPath: "ownership_id" })
        }

        if (!db.objectStoreNames.contains("access_bindings")) {
          db.createObjectStore("access_bindings", { keyPath: "access_id" })
        }
      }
    })
  }

  async getAccessBinding(access_id: string): Promise<AccessBinding | null> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["access_bindings"], "readonly")
      const store = transaction.objectStore("access_bindings")
      const request = store.get(access_id)

      request.onsuccess = () => {
        const result = request.result as AccessBinding | undefined
        resolve(result || null)
      }

      request.onerror = () => reject(request.error)
    })
  }

  async getAllOwnerships(): Promise<OwnershipRecord[]> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["ownerships"], "readonly")
      const store = transaction.objectStore("ownerships")
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result as OwnershipRecord[]
        resolve(results)
      }

      request.onerror = () => reject(request.error)
    })
  }

  async getOwnership(ownership_id: string): Promise<OwnershipRecord | null> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["ownerships"], "readonly")
      const store = transaction.objectStore("ownerships")
      const request = store.get(ownership_id)

      request.onsuccess = () => {
        const result = request.result as OwnershipRecord | undefined
        resolve(result || null)
      }

      request.onerror = () => reject(request.error)
    })
  }

  async saveOwnership(ownership: OwnershipRecord): Promise<void> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["ownerships"], "readwrite")
      const store = transaction.objectStore("ownerships")
      const request = store.put(ownership)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async updateOwnership(ownership_id: string, updates: Partial<OwnershipRecord>): Promise<void> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["ownerships"], "readwrite")
      const store = transaction.objectStore("ownerships")
      const getReq = store.get(ownership_id)

      getReq.onsuccess = () => {
        const existing = getReq.result as OwnershipRecord | undefined
        if (!existing) {
          reject(new Error("Ownership not found"))
          return
        }
        const putReq = store.put({ ...existing, ...updates })
        putReq.onerror = () => reject(putReq.error)
      }

      getReq.onerror = () => reject(getReq.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async createAccessBinding(binding: AccessBinding): Promise<void> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["access_bindings"], "readwrite")
      const store = transaction.objectStore("access_bindings")
      const request = store.put(binding)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async updateLastUsed(access_id: string): Promise<void> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["access_bindings"], "readwrite")
      const store = transaction.objectStore("access_bindings")
      const getReq = store.get(access_id)

      getReq.onsuccess = () => {
        const binding = getReq.result as AccessBinding | undefined
        if (!binding) {
          resolve()
          return
        }
        binding.lastUsedAt = Date.now()
        const putReq = store.put(binding)
        putReq.onerror = () => reject(putReq.error)
      }

      getReq.onerror = () => reject(getReq.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async deleteAccessBinding(access_id: string): Promise<void> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["access_bindings"], "readwrite")
      const store = transaction.objectStore("access_bindings")
      const request = store.delete(access_id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAllAccessBindings(): Promise<AccessBinding[]> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["access_bindings"], "readonly")
      const store = transaction.objectStore("access_bindings")
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result as AccessBinding[]
        resolve(results)
      }

      request.onerror = () => reject(request.error)
    })
  }

  async deleteOwnership(ownership_id: string): Promise<void> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["ownerships"], "readwrite")
      const store = transaction.objectStore("ownerships")
      const request = store.delete(ownership_id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Atomically delete ownership(s) and update/remove the access binding
   * in a single transaction spanning both object stores.
   */
  async deleteOwnershipAndUpdateBinding(
    ownershipIds: string[],
    accessId: string,
  ): Promise<void> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ["ownerships", "access_bindings"],
        "readwrite",
      )
      const ownershipStore = transaction.objectStore("ownerships")
      const bindingStore = transaction.objectStore("access_bindings")

      // Delete all specified ownerships
      for (const id of ownershipIds) {
        ownershipStore.delete(id)
      }

      // Get the binding, then update or delete it
      const getReq = bindingStore.get(accessId)
      getReq.onsuccess = () => {
        const binding = getReq.result as AccessBinding | undefined
        if (!binding) return

        const remaining = binding.ownership_ids.filter(
          (id) => !ownershipIds.includes(id),
        )

        if (remaining.length === 0) {
          bindingStore.delete(accessId)
        } else {
          bindingStore.put({
            ...binding,
            ownership_ids: remaining,
            activeOwnershipId:
              remaining.includes(binding.activeOwnershipId ?? "")
                ? binding.activeOwnershipId
                : remaining[0],
          })
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * Atomically remove an ownership from all access bindings.
   * Used during restore-overwrite to unlink before re-saving.
   */
  async removeOwnershipFromAllBindings(ownershipId: string): Promise<void> {
    if (!this.db) throw new Error("DB not initialized")

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["access_bindings"], "readwrite")
      const store = transaction.objectStore("access_bindings")
      const request = store.getAll()

      request.onsuccess = () => {
        const bindings = request.result as AccessBinding[]
        for (const binding of bindings) {
          if (!binding.ownership_ids.includes(ownershipId)) continue

          const remaining = binding.ownership_ids.filter((id) => id !== ownershipId)
          if (remaining.length === 0) {
            store.delete(binding.access_id)
          } else {
            store.put({
              ...binding,
              ownership_ids: remaining,
              activeOwnershipId:
                binding.activeOwnershipId === ownershipId
                  ? remaining[0]
                  : binding.activeOwnershipId,
            })
          }
        }
      }

      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
}
