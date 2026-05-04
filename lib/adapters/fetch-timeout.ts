const RPC_TIMEOUT_MS = 10_000 // 10 seconds

/**
 * Fetch with an AbortController timeout.
 * Prevents serverless functions from hanging on slow/unresponsive RPC endpoints.
 */
export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout))
}
