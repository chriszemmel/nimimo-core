/**
 * Migrate all ownerships in the database
 * Safe to run multiple times (idempotent)
 */
export async function migrateAllOwnerships(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["ownerships"], "readwrite")
    const store = transaction.objectStore("ownerships")
    const request = store.openCursor()

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null

      if (cursor) {
        const ownership = cursor.value
        const needsMigration = !ownership.recovery || !ownership.protection || ownership.version === "v1"

        if (needsMigration) {
          const migrated = {
            ...ownership,
            recovery: ownership.recovery || {
              state: "none",
              method: null,
              lastCreatedAt: null,
              lastVerifiedAt: null,
            },
            protection: ownership.protection || "device",
            version: "v2",
          }

          cursor.update(migrated)
        }

        cursor.continue()
      } else {
        resolve()
      }
    }

    request.onerror = () => reject(request.error)
  })
}
