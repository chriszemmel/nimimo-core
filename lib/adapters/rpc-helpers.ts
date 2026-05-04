interface RPCEndpoint {
  name: string
  url: string
  priority: number
  requiresApiKey?: boolean
}

interface RPCTarget {
  url: string
  headers: Record<string, string>
}

/**
 * Resolve an RPC endpoint to a URL + headers.
 * Alchemy API key is passed via Authorization header (not in URL path)
 * to prevent key exposure in server logs, CDN caches, and proxy logs.
 *
 * Returns null if the endpoint requires an API key but none is configured.
 */
export function resolveRPCEndpoint(endpoint: RPCEndpoint): RPCTarget | null {
  const apiKey = process.env.ALCHEMY_API_KEY

  if (endpoint.requiresApiKey) {
    if (!apiKey) return null
    return {
      url: endpoint.url,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    }
  }

  return {
    url: endpoint.url,
    headers: { "Content-Type": "application/json" },
  }
}
