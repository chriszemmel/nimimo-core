"use client"

import { useState, useRef, useEffect } from "react"
import { CroodlesAvatar } from "@/components/croodles-avatar"

interface AvatarGlowProps {
  handle: string
  avatarUrl: string | null
  size?: number
}

export function AvatarGlow({ handle, avatarUrl, size = 88 }: AvatarGlowProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Reset loaded state when avatarUrl changes
  useEffect(() => {
    setLoaded(false)
    setError(false)
  }, [avatarUrl])

  // Handle cached images where onLoad may not fire (especially Safari)
  useEffect(() => {
    const img = imgRef.current
    if (!img || !avatarUrl) return
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true)
      return
    }
    // Fallback: recheck after a frame in case onLoad was missed
    const raf = requestAnimationFrame(() => {
      if (img.complete && img.naturalWidth > 0) {
        setLoaded(true)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [avatarUrl])

  return (
    <div className="avatar-glow flex items-center justify-center">
      <div
        className="relative rounded-full overflow-hidden z-10"
        style={{ width: size, height: size }}
      >
        {avatarUrl && !error ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 rounded-full bg-secondary animate-pulse" />
            )}
            <img
              ref={imgRef}
              src={avatarUrl}
              alt={`@${handle}`}
              className="w-full h-full object-cover"
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
          </>
        ) : (
          <CroodlesAvatar handle={handle} size={size} />
        )}
      </div>
    </div>
  )
}
