import type { ComponentType } from "react"
import type { TemplateProps, TemplateId, PaletteId } from "./types"
import { TemplateClassic } from "./template-classic"
import { TemplateMinimal } from "./template-minimal"
import { TemplateBold } from "./template-bold"
import { TemplateStack } from "./template-stack"

export type { TemplateProps, TemplateId, PaletteId }

export interface TemplateEntry {
  id: TemplateId
  name: string
  description: string
  component: ComponentType<TemplateProps>
  premium?: boolean
  light?: boolean // light-themed template - disables palette
  themed?: boolean // self-themed - has own color scheme, disables palette
}

/** Core templates - always available */
export const CORE_TEMPLATES: TemplateEntry[] = [
  { id: "classic", name: "Classic", description: "Clean layout with visible addresses", component: TemplateClassic },
  { id: "minimal", name: "Minimal", description: "Identity-first with hidden addresses", component: TemplateMinimal },
  { id: "bold", name: "Bold", description: "Statement page with expandable chains", component: TemplateBold },
  { id: "stack", name: "Stack", description: "Digital business card style", component: TemplateStack },
]

export const TEMPLATES: TemplateEntry[] = [...CORE_TEMPLATES]

export function getAllTemplates(): TemplateEntry[] {
  return TEMPLATES
}

const TEMPLATE_MAP = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t])
) as Record<string, TemplateEntry>

export function getTemplate(id: string): TemplateEntry {
  return TEMPLATE_MAP[id] ?? TEMPLATE_MAP.classic
}

export interface PaletteEntry {
  id: PaletteId
  name: string
  colors: [string, string, string] // start, mid, end
}

export const PALETTES: PaletteEntry[] = [
  { id: "default", name: "Default", colors: ["#3CF2D6", "#41c6e9", "#7B61FF"] },
  { id: "ember", name: "Ember", colors: ["#FF8C42", "#FF6B6B", "#E040FB"] },
  { id: "green", name: "Green", colors: ["#4ADE80", "#22C55E", "#15803D"] },
  { id: "gold", name: "Gold", colors: ["#FFD700", "#F5A623", "#D4860B"] },
  { id: "purple", name: "Purple", colors: ["#A855F7", "#8B5CF6", "#6D28D9"] },
  { id: "rose", name: "Rose", colors: ["#FB7185", "#F43F5E", "#BE123C"] },
  { id: "ice", name: "Ice", colors: ["#7DD3FC", "#38BDF8", "#0284C7"] },
  { id: "sunset", name: "Sunset", colors: ["#FBBF24", "#F97316", "#DC2626"] },
  { id: "midnight", name: "Midnight", colors: ["#818CF8", "#6366F1", "#4338CA"] },
]
