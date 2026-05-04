import type React from "react"

export default function CallbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This layout intentionally has no header wrapper
  // to provide a clean loading experience for magic link verification
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">{children}</div>
}
