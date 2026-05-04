"use client"

import { useEffect, useState } from "react"
import { generateCroodlesSVG } from "@/lib/croodles/generator"

interface CroodlesAvatarProps {
  handle: string
  size?: number
  className?: string
}

export function CroodlesAvatar({ handle, size = 40, className = "" }: CroodlesAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string>("")

  useEffect(() => {
    if (!handle || handle.length === 0) {
      return
    }
    // Generate the avatar URL client-side
    const url = generateCroodlesSVG(handle)
    setAvatarUrl(url)
  }, [handle])

  if (!handle || !avatarUrl) {
    return (
      <div className={`rounded-full bg-secondary animate-pulse ${className}`} style={{ width: size, height: size }} />
    )
  }

  return (
    <div className={`rounded-full overflow-hidden ${className}`} style={{ width: size, height: size }}>
      <img src={avatarUrl || "/placeholder.svg"} alt={`@${handle}`} className="w-full h-full" />
    </div>
  )
}
