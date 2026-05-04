"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors cursor-pointer"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  )
}
