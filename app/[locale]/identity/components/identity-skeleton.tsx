"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { useEffect } from "react"

export function IdentitySkeleton() {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [])

  return (
    <div className="flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-7 md:py-11">
        <div className="max-w-2xl mx-auto space-y-7">

          {/* h1 "Your Identity" - text-2xl → h-8 */}
          <Skeleton className="h-8 w-36" />

          {/* IdentityHeader: avatar + handle + status */}
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
            <div className="flex flex-col">
              {/* text-xl → line-height 1.75rem = 28px = h-7 */}
              <Skeleton className="h-7 w-44" />
              {/* text-xs → line-height 1rem = 16px = h-4 */}
              <Skeleton className="h-4 w-14 mt-1" />
            </div>
          </div>

          {/* "Your receiving details" section */}
          <div className="space-y-6">
            <div>
              {/* h2 text-sm → line-height 1.25rem = 20px = h-5 */}
              <Skeleton className="h-5 w-40 mb-4" />

              <div className="space-y-3">

                {/* ReceiveMethodNimimo */}
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        {/* "nimimo" label + info icon row - text-sm = h-5 */}
                        <Skeleton className="h-5 w-16" />
                        {/* handle - font-mono text-sm = h-5 */}
                        <Skeleton className="h-5 w-32" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* p-2 button + w-4 h-4 icon = 32px total = w-8 h-8 */}
                      <Skeleton className="w-8 h-8 rounded" />
                      <Skeleton className="w-8 h-8 rounded" />
                    </div>
                  </div>
                </div>

                {/* ReceiveMethodBlockchain × 3 */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden bg-card">
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                        {/* chain name - text-sm = h-5 */}
                        <Skeleton className="h-5 w-20" />
                      </div>
                      {/* ChevronDown w-5 h-5 */}
                      <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
                    </div>
                  </div>
                ))}

              </div>
            </div>
          </div>

          {/* RecoveryCard */}
          <div className="border border-border rounded-lg bg-card p-4 shadow-sm">
            <div className="w-full flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-3">
                  {/* "Created" label - text-sm, w-[72px] to match span width */}
                  <Skeleton className="h-5 w-[72px] flex-shrink-0" />
                  {/* date value */}
                  <Skeleton className="h-5 w-28" />
                </div>
                <div className="flex items-center gap-3">
                  {/* "Recovery" label */}
                  <Skeleton className="h-5 w-[72px] flex-shrink-0" />
                  {/* status badge - text-xs + py-0.5 ≈ h-5, rounded-md */}
                  <Skeleton className="h-5 w-36 rounded-md" />
                </div>
              </div>
              {/* ChevronDown w-5 h-5 */}
              <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
