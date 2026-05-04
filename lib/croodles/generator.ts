"use client"

/**
 * Deterministic Croodles avatar generator for nimimo
 * Generates consistent avatars based on user handle/seed
 */

// Brand-aligned backgrounds (5 only)
const backgrounds = [
  { name: "azure", color: "e0f2fe" },
  { name: "muted", color: "f1f5f9" },
  { name: "border", color: "e2e8f0" },
  { name: "blue", color: "eef2ff" },
  { name: "tide", color: "dbeafe" },
]

/**
 * Simple hash function to generate consistent index from string
 */
function hashString(input: string): number {
  if (!input || input.length === 0) {
    return 0
  }
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Get deterministic background for a handle
 */
export function backgroundForHandle(handle: string): { name: string; color: string } {
  if (!handle || handle.length === 0) {
    return backgrounds[0]
  }
  const hash = hashString(handle)
  const index = hash % backgrounds.length
  return backgrounds[index]
}

/**
 * Generate SVG for Croodles avatar using DiceBear API
 */
export function generateCroodlesSVG(handle: string): string {
  if (!handle || handle.length === 0) {
    handle = "anonymous"
  }
  const bg = backgroundForHandle(handle)

  // Proxy through our own API to avoid CSP img-src restrictions
  const seed = encodeURIComponent(handle.toLowerCase())
  const backgroundColor = encodeURIComponent(bg.color)

  return `/api/avatar?seed=${seed}&bg=${backgroundColor}`
}
