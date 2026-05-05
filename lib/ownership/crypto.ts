// Cryptographic utilities for ownership layer

import * as bip39 from "bip39"

// ============================================================================
// DEVICE-BOUND ENCRYPTION (KEK₁) - No PIN required for daily use
// ============================================================================

const DB_NAME = "nimimo-device-keys"
const DB_VERSION = 1
const STORE_NAME = "device-key"
const KEY_MATERIAL_ID = "device-key-material"
const SALT_ID = "device-salt"

/**
 * Opens IndexedDB for device key storage
 */
async function openDeviceKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/**
 * Retrieves or generates a persistent 32-byte value from IndexedDB.
 */
async function getOrCreateDeviceBytes(id: string): Promise<Uint8Array> {
  const db = await openDeviceKeyDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      if (getRequest.result) {
        resolve(new Uint8Array(getRequest.result))
      } else {
        const newBytes = window.crypto.getRandomValues(new Uint8Array(32))
        const putRequest = store.put(newBytes, id)

        putRequest.onsuccess = () => resolve(newBytes)
        putRequest.onerror = () => reject(putRequest.error)
      }
    }

    getRequest.onerror = () => reject(getRequest.error)
    transaction.oncomplete = () => db.close()
  })
}

/**
 * Generates a device-bound encryption key using WebCrypto
 * This key is derived from device-specific entropy stored in IndexedDB
 * It enables daily operations without PIN prompts
 */
async function deriveDeviceBoundKey(): Promise<CryptoKey> {
  // Key material and salt are independent 32-byte random values
  const deviceKeyMaterial = await getOrCreateDeviceBytes(KEY_MATERIAL_ID)
  const deviceSalt = await getOrCreateDeviceBytes(SALT_ID)

  const keyMaterial = await window.crypto.subtle.importKey("raw", deviceKeyMaterial as BufferSource, "PBKDF2", false, ["deriveKey"])

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: deviceSalt as BufferSource,
      iterations: 600000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

// ============================================================================
// BIP-39 MNEMONIC GENERATION
// ============================================================================

/**
 * Generates a cryptographically secure 24-word BIP-39 mnemonic.
 * 256 bits of entropy + 8-bit SHA-256 checksum = 264 bits = 24 words.
 */
export async function generateSecureSeed(): Promise<string> {
  const entropy = window.crypto.getRandomValues(new Uint8Array(32))
  const entropyHex = Array.from(entropy)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return bip39.entropyToMnemonic(entropyHex)
}

// ============================================================================
// ENCRYPTION (Device-bound KEK₁)
// ============================================================================

/**
 * Encrypts the mnemonic with device-bound encryption
 * This is KEK₁ - no PIN required, enables daily operations
 *
 * IMPORTANT: We encrypt the MNEMONIC STRING, not the derived seed
 */
export async function encryptSeed(
  mnemonic: string,
  ownershipId: string,
): Promise<{
  encryptedSeed: string
  iv: string
}> {
  // Derive device-bound key
  const key = await deriveDeviceBoundKey()

  // Generate random IV for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  // Prepare AAD (additional authenticated data) for version + ownership binding
  const encoder = new TextEncoder()
  const aad = encoder.encode(`v2:${ownershipId}`)

  // Convert mnemonic to bytes
  const mnemonicBytes = encoder.encode(mnemonic)

  // Encrypt mnemonic with AES-256-GCM
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      additionalData: aad,
    },
    key,
    mnemonicBytes,
  )

  return {
    encryptedSeed: arrayBufferToBase64(new Uint8Array(encryptedData)),
    iv: arrayBufferToBase64(iv),
  }
}

/**
 * Decrypts the mnemonic using device-bound key
 * Returns the mnemonic string for address derivation
 */
export async function decryptSeed(encryptedSeedBase64: string, ivBase64: string, ownershipId: string): Promise<string> {
  const key = await deriveDeviceBoundKey()
  const encryptedData = base64ToArrayBuffer(encryptedSeedBase64)
  const iv = base64ToArrayBuffer(ivBase64)

  // Prepare AAD
  const encoder = new TextEncoder()
  const aad = encoder.encode(`v2:${ownershipId}`)

  // Decrypt
  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      additionalData: aad,
    },
    key,
    encryptedData as BufferSource,
  )

  // Convert back to mnemonic string
  const decoder = new TextDecoder()
  const mnemonic = decoder.decode(decryptedData)

  return mnemonic
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function arrayBufferToBase64(buffer: Uint8Array): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Deletes all device key material and salt from IndexedDB.
 * Should be called when the user removes all ownerships from the device.
 */
export async function clearDeviceKeys(): Promise<void> {
  const db = await openDeviceKeyDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    store.delete(KEY_MATERIAL_ID)
    store.delete(SALT_ID)

    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

/**
 * Generates a cryptographically secure UUID v4
 * Used for ownership_id generation
 */
export function generateOwnershipId(): string {
  // Use crypto.randomUUID() for cryptographic security
  return crypto.randomUUID()
}
