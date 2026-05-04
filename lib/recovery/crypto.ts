// Recovery-specific cryptographic utilities

// #region derive-pin-key
/**
 * Derives a PIN-based encryption key using PBKDF2
 * This is used for recovery file encryption
 */
export async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const pinBytes = encoder.encode(pin)

  const keyMaterial = await window.crypto.subtle.importKey("raw", pinBytes, "PBKDF2", false, ["deriveKey"])

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 600000, // High iteration count for security
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}
// #endregion derive-pin-key

/**
 * Encrypts recovery data with PIN-derived key
 */
export async function encryptRecoveryData(
  data: string,
  pin: string,
): Promise<{
  encryptedData: string
  iv: string
  salt: string
}> {
  const salt = window.crypto.getRandomValues(new Uint8Array(32))
  const key = await derivePinKey(pin, salt)
  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  const encoder = new TextEncoder()
  const dataBytes = encoder.encode(data)

  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    dataBytes,
  )

  return {
    encryptedData: arrayBufferToBase64(new Uint8Array(encryptedData)),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
  }
}

/**
 * Decrypts recovery data with PIN
 */
export async function decryptRecoveryData(
  encryptedDataBase64: string,
  ivBase64: string,
  saltBase64: string,
  pin: string,
): Promise<string> {
  const salt = base64ToArrayBuffer(saltBase64)
  const key = await derivePinKey(pin, salt)
  const iv = base64ToArrayBuffer(ivBase64)
  const encryptedData = base64ToArrayBuffer(encryptedDataBase64)

  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
    },
    key,
    encryptedData as BufferSource,
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedData)
}

// Utility functions
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
