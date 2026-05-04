import { signOut } from "next-auth/react"

const MAX_RETRIES = 2
const BASE_DELAY_MS = 2000

/**
 * Wrapper around fetch that handles expired sessions and rate limits.
 * On 401, signs out and redirects to login.
 * On 429, retries with exponential backoff (skips auth paths to avoid amplification).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastResponse: Response | undefined

  // Don't retry auth endpoints - NextAuth handles its own refresh logic
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
  const isAuthPath = url.includes("/api/auth/")

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const retryAfter = lastResponse?.headers.get("Retry-After")
      const delay = retryAfter
        ? Math.min(Number(retryAfter) * 1000, 16000)
        : BASE_DELAY_MS * 2 ** (attempt - 1)
      await new Promise((r) => setTimeout(r, delay))
    }

    const response = await fetch(input, init)

    if (response.status === 401) {
      await signOut({ redirect: false })
      window.location.href = "/auth/login"
      return response
    }

    if (response.status === 429 && attempt < MAX_RETRIES && !isAuthPath) {
      lastResponse = response
      continue
    }

    return response
  }

  return lastResponse!
}
