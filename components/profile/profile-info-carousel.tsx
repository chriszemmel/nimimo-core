"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Calendar, Shield } from "lucide-react"

interface ProfileInfoCarouselProps {
  createdAt: string
}

const SLIDES = [
  { id: "created", icon: Calendar, label: "Member since" },
  { id: "about", icon: Shield, label: "About nimimo" },
] as const

export function ProfileInfoCarousel({ createdAt }: ProfileInfoCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex(idx)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {/* Slide 1: Created date */}
        <div className="snap-center shrink-0 w-full px-1">
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground">Member since</p>
              <p className="text-foreground font-medium">{createdAt}</p>
            </div>
          </div>
        </div>

        {/* Slide 2: About nimimo */}
        <div className="snap-center shrink-0 w-full px-1">
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              nimimo - crypto identity you can share.
            </p>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-2">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === activeIndex ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
