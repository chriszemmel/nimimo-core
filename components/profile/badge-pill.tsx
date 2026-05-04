"use client"

import { Gem, Rocket, Crown, Star, CheckCircle2 } from "lucide-react"
import type { BadgeId } from "@/lib/badges"
import { BADGE_MAP } from "@/lib/badges"

interface BadgePillProps {
  id: BadgeId
  size?: "sm" | "md"
}

const ICON_MAP: Record<BadgeId, React.ComponentType<{ className?: string }>> = {
  founder: Gem,
  "early-adopter": Rocket,
  premium: Crown,
  og: Star,
  verified: CheckCircle2,
}

export function BadgePill({ id, size = "sm" }: BadgePillProps) {
  const badge = BADGE_MAP[id]
  if (!badge) return null

  const Icon = ICON_MAP[id]
  const isSm = size === "sm"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border ${
        isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      style={{
        color: badge.color,
        borderColor: `${badge.color}30`,
        backgroundColor: `${badge.color}12`,
      }}
    >
      <Icon className={isSm ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {badge.label}
    </span>
  )
}

interface BadgeRowProps {
  badges: string[]
  size?: "sm" | "md"
}

export function BadgeRow({ badges, size = "sm" }: BadgeRowProps) {
  const valid = badges.filter((b) => b in BADGE_MAP) as BadgeId[]
  if (valid.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {valid.map((id) => (
        <BadgePill key={id} id={id} size={size} />
      ))}
    </div>
  )
}
