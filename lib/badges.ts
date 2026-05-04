export type BadgeId = "founder" | "early-adopter" | "premium" | "og" | "verified"

export interface BadgeDefinition {
  id: BadgeId
  label: string
  color: string
  description: string
}

export const BADGES: BadgeDefinition[] = [
  { id: "founder", label: "Founder", color: "#F59E0B", description: "Platform founder" },
  { id: "verified", label: "Verified", color: "#3B82F6", description: "Verified identity" },
  { id: "og", label: "OG", color: "#A855F7", description: "Original member" },
  { id: "early-adopter", label: "Early Adopter", color: "#45E6D1", description: "Joined during early access" },
  { id: "premium", label: "Premium", color: "#FFD700", description: "Premium subscriber" },
]

export const BADGE_MAP = Object.fromEntries(
  BADGES.map((b) => [b.id, b])
) as Record<BadgeId, BadgeDefinition>
