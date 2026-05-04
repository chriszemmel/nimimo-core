"use client"

import { useEffect } from "react"

interface Props {
  /** Number of balance rows to show. Defaults to 4 (BTC/ETH/SOL/USDC); pass 5 when a custom chain is enabled. */
  rows?: number
}

export function WalletSkeleton({ rows = 4 }: Props = {}) {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [])

  return (
    <div className="flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-7 md:py-11">
        <div className="max-w-2xl mx-auto space-y-7">

          {/* Title row: h1 text-2xl (h-8=32px) + balance button (px-3 py-1.5 text-sm = h-8) */}
          <div className="flex items-center justify-between">
            <div className="h-8 w-36 bg-muted/40 animate-pulse-soft rounded-md" />
            <div className="h-8 w-24 bg-muted/40 animate-pulse-soft rounded-md" />
          </div>

          <div className="space-y-6">
            <div>
              {/* Section header: h2 text-sm (h-5=20px) + Button size="sm" h-8 */}
              <div className="flex items-center justify-between mb-4">
                <div className="h-5 w-16 bg-muted/40 animate-pulse-soft rounded-md" />
                <div className="h-8 w-8 bg-muted/40 animate-pulse-soft rounded-md" />
              </div>

              {/* Balance cards */}
              <div className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden bg-card">
                    <div className="px-4 py-4 flex items-center justify-between">
                      {/* Left: logo circle (w-10 h-10=40px) + name (font-medium text-base = h-6=24px) */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted/40 animate-pulse-soft flex-shrink-0" />
                        <div className="h-6 w-20 bg-muted/40 animate-pulse-soft rounded-md" />
                      </div>
                      {/* Right: value col (text-sm h-5 + text-xs h-4, no gap) + chevron w-5 h-5 */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <div className="h-5 w-28 bg-muted/40 animate-pulse-soft rounded-md" />
                          <div className="h-4 w-16 bg-muted/40 animate-pulse-soft rounded-md mt-0" />
                        </div>
                        <div className="w-5 h-5 bg-muted/40 animate-pulse-soft rounded-md flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Send button - default Button h-9 */}
          <div className="flex justify-center pt-4">
            <div className="h-9 w-24 bg-muted/40 animate-pulse-soft rounded-md" />
          </div>

        </div>
      </main>
    </div>
  )
}
