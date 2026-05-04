"use client"

import { ArrowRight } from "lucide-react"

interface HeroCtaProps {
  handle: string
  onClick: () => void
  showOwnProfileMsg?: boolean
  showLoginMsg?: boolean
}

export function HeroCta({ handle, onClick, showOwnProfileMsg, showLoginMsg }: HeroCtaProps) {
  return (
    <button
      onClick={onClick}
      className="cta-pill w-full flex items-center justify-center gap-2 text-base font-semibold text-background cursor-pointer"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {showLoginMsg ? (
        <span className="text-sm">Sign in to send</span>
      ) : showOwnProfileMsg ? (
        <span className="text-sm">This is your profile</span>
      ) : (
        <>
          Send to @{handle}
          <ArrowRight className="w-5 h-5" />
        </>
      )}
    </button>
  )
}
