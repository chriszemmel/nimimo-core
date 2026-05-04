"use client"

import { useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { CopyButton } from "./copy-button"

const DEFAULT_HANDLE = "neat-gecko"

export function TryResolve() {
  const [handle, setHandle] = useState(DEFAULT_HANDLE)
  const [chain, setChain] = useState<string>("")
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const params = new URLSearchParams({ handle: handle.trim() })
      if (chain) params.set("chain", chain)
      const res = await fetch(`/api/v1/resolve?${params}`)
      const data = await res.json()
      setResult(JSON.stringify(data, null, 2))
      if (!res.ok) setError(`${res.status}`)
    } catch {
      setError("Network error")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const url = `https://nimimo.com/api/v1/resolve?handle=${handle.trim()}${chain ? `&chain=${chain}` : ""}`

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
        <div className="px-4 py-2.5 bg-primary/10 border-b border-primary/20 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary font-mono">
            GET
          </span>
          <span className="text-xs text-muted-foreground font-mono">/api/v1/resolve</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">handle</label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="neat-gecko"
                className="w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="w-full sm:w-36 space-y-1">
              <label className="text-xs text-muted-foreground">chain <span className="text-muted-foreground/40">(optional)</span></label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                <option value="">All chains</option>
                <option value="bitcoin">bitcoin</option>
                <option value="ethereum">ethereum</option>
                <option value="solana">solana</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60 overflow-x-auto">
            <span className="shrink-0">{url}</span>
          </div>

          <button
            onClick={handleFetch}
            disabled={loading || !handle.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                Send request <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <div className="px-4 py-2 bg-muted/20 border-b border-border/40 flex items-center justify-between">
            <span className={`text-xs font-mono ${error ? "text-red-400" : "text-green-400"}`}>
              {error ? `Error ${error}` : "200 OK"}
            </span>
            <CopyButton text={result} />
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-foreground/90 bg-background/50 leading-relaxed">
            <code>{result}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
