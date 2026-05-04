import type { ReactNode } from "react"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"
import type { ChainType } from "@/components/send-flow/types"

export interface TemplateProps {
  handle: string
  bio: string | null
  avatarUrl: string | null
  createdAt: string
  addresses: DerivedAddress[]
  isOwnProfile: boolean
  isLoggedIn: boolean
  // When true, the template is rendered as a decorative preview (e.g. inside
  // the landing-page template carousel) rather than as the live page for a
  // real `/@handle` profile. Templates MUST downgrade their handle heading
  // from <h1> to a non-heading element in this mode - otherwise the homepage
  // ends up with one <h1> per showcased template, which Bing Webmaster Tools
  // flags as an SEO issue ("more than one h1 tag"). Defaults to false so the
  // real profile pages keep their <h1> and their SEO weight.
  isPreview?: boolean
  // Avatar edit (only active when isOwnProfile)
  onAvatarUpload: () => void
  onAvatarDelete: () => void
  avatarUploading: boolean
  // Bio edit
  onBioEdit: () => void
  // Send flow (chain optional - if omitted, SendFlow shows chain selector)
  onSend: (chain?: ChainType) => void
  sendOwnProfile?: boolean // true briefly when user tries to send to themselves
  sendLoginMsg?: boolean // true briefly when logged-out user clicks send
  // Badges
  badges?: string[]
  // Content cards slot (rendered above member-since / info carousel)
  contentSlot?: ReactNode
  // Tip heart overlay (rendered inside avatar container, bottom-right)
  tipOverlay?: ReactNode
}

export type TemplateId = string
export type PaletteId = "default" | "ember" | "green" | "gold" | "purple" | "rose" | "ice" | "sunset" | "midnight"
