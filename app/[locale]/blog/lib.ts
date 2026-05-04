import { neon } from "@neondatabase/serverless"

export interface BlogSection {
  type: "paragraph" | "heading" | "list" | "code" | "callout" | "quote"
  content: string
  level?: 2 | 3
  items?: string[]
  language?: string
  variant?: "info" | "warning"
  attribution?: string
}

export interface BlogArticle {
  id: number
  slug: string
  title: string
  subtitle: string
  description: string
  author: string
  publishedAt: string
  tags: string[]
  cta?: {
    text: string
    href: string
  }
  sections: BlogSection[]
}

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

function rowToArticle(row: Record<string, unknown>): BlogArticle {
  // published_at can come back as Date object or string depending on driver
  const pubRaw = row.published_at
  const publishedAt =
    pubRaw instanceof Date
      ? pubRaw.toISOString().slice(0, 10)
      : String(pubRaw).slice(0, 10)

  // JSONB columns may come back as parsed objects or strings
  const tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags
  const cta = typeof row.cta === "string" ? JSON.parse(row.cta) : row.cta
  const sections = typeof row.sections === "string" ? JSON.parse(row.sections) : row.sections

  return {
    id: row.id as number,
    slug: row.slug as string,
    title: row.title as string,
    subtitle: row.subtitle as string,
    description: row.description as string,
    author: row.author as string,
    publishedAt,
    tags: tags || [],
    cta: cta || undefined,
    sections: sections || [],
  }
}

export async function getAllArticles(): Promise<BlogArticle[]> {
  try {
    const sql = getDb()
    const rows = await sql`
      SELECT * FROM blog_posts
      WHERE published_at <= CURRENT_DATE
      ORDER BY published_at DESC
    `
    return rows.map(rowToArticle)
  } catch {
    // Table may not exist yet during first build
    return []
  }
}

export async function getArticleBySlug(slug: string): Promise<BlogArticle | null> {
  try {
    const sql = getDb()
    const rows = await sql`
      SELECT * FROM blog_posts
      WHERE slug = ${slug} AND published_at <= CURRENT_DATE
      LIMIT 1
    `
    return rows.length > 0 ? rowToArticle(rows[0]) : null
  } catch {
    return null
  }
}

export async function getAdjacentArticles(currentId: number): Promise<{
  prev: BlogArticle | null
  next: BlogArticle | null
}> {
  const all = await getAllArticles()
  // Sort by date ascending for prev/next logic
  const sorted = [...all].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  )
  const idx = sorted.findIndex((a) => a.id === currentId)
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function estimateReadingTime(sections: BlogSection[]): string {
  const words = sections.reduce((count, section) => {
    let text = section.content || ""
    if (section.items) text += " " + section.items.join(" ")
    return count + text.split(/\s+/).length
  }, 0)
  const minutes = Math.max(1, Math.ceil(words / 230))
  return `${minutes} min read`
}
