import { logger } from "@/lib/logger"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { neon } from "@neondatabase/serverless"
import { getTranslations } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/json-ld"
import { SITE_URL } from "@/lib/site-config"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"
import { ProfileContent } from "@/components/profile/profile-content"
import { ensureMigrations } from "@/lib/db"
import { cached } from "@/lib/adapters/cache"

const log = logger("profile")

export const dynamic = "force-dynamic"

interface ProfilePageProps {
  params: Promise<{
    handle: string
  }>
}

function isValidHandle(handle: string): boolean {
  // Skip system routes and files
  const invalidPatterns = [
    /^_next/,
    /^api/,
    /^auth/,
    /^profile/,
    /^settings/,
    /^protection/,
    /\.(ico|png|jpg|svg|json|xml|txt|js|css|html)$/,
    /^favicon/,
    /^robots/,
    /^sitemap/,
    /^logos/,
    /^images/,
    /^public/,
  ]

  if (invalidPatterns.some((pattern) => pattern.test(handle))) {
    return false
  }

  // Valid handles: lowercase alphanumeric, optional hyphens (e.g. chris, cool-water, test-123)
  const handlePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
  return handlePattern.test(handle)
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params
  const t = await getTranslations("profile")

  if (!isValidHandle(handle)) {
    return { title: t("identityNotFoundTitle") }
  }

  await ensureMigrations()
  const sql = neon(process.env.DATABASE_URL!)
  try {
    // Check handle_registry first, then identities.handle
    const registry = await sql`
      SELECT hr.ownership_id FROM handle_registry hr
      JOIN identities i ON i.ownership_id = hr.ownership_id AND i.status = 'active'
      WHERE hr.handle = ${handle} LIMIT 1
    `
    let ownershipId: string | null = null
    if (registry.length > 0) {
      ownershipId = registry[0].ownership_id as string
    } else {
      const direct = await sql`
        SELECT ownership_id FROM identities WHERE handle = ${handle} AND status = 'active' LIMIT 1
      `
      if (direct.length > 0) ownershipId = direct[0].ownership_id as string
    }
    if (!ownershipId) {
      return { title: t("identityNotFoundTitle") }
    }

    // Get display handle + bio
    const primaryRow = await sql`
      SELECT handle FROM handle_registry WHERE ownership_id = ${ownershipId} AND type = 'primary' LIMIT 1
    `
    const identityRow = await sql`
      SELECT handle, bio FROM identities WHERE ownership_id = ${ownershipId} AND status = 'active' LIMIT 1
    `
    const displayHandle = primaryRow.length > 0 ? primaryRow[0].handle as string : identityRow[0]?.handle as string
    const bio: string | null = identityRow[0]?.bio ?? null
    const title = `@${displayHandle}`
    const description = bio || `Send crypto to @${displayHandle} on nimimo. Bitcoin, Ethereum, Solana - no app needed.`

    return {
      title,
      description,
      openGraph: {
        type: "profile",
        title: `@${displayHandle} on nimimo`,
        description,
        url: `${SITE_URL}/@${displayHandle}`,
        siteName: "nimimo",
      },
      twitter: {
        card: "summary_large_image",
        title: `@${displayHandle} on nimimo`,
        description,
      },
      alternates: {
        canonical: `${SITE_URL}/@${displayHandle}`,
      },
    }
  } catch {
    return { title: t("identityNotFoundTitle") }
  }
}

async function PageNotFound() {
  const t = await getTranslations("profile")
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">{t("pageNotFoundTitle")}</h1>
            <p className="text-muted-foreground">{t("pageNotFoundBody")}</p>
          </div>
          <Button asChild className="w-full">
            <Link href="/">{t("goToHomepage")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

async function NotFoundInline() {
  const t = await getTranslations("profile")
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">{t("identityNotFoundTitle")}</h1>
            <p className="text-muted-foreground">{t("identityNotFoundBody")}</p>
          </div>
          <Button asChild className="w-full">
            <Link href="/">{t("goToHomepage")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params

  // Only allow access via /@handle (middleware sets this header)
  const headersList = await headers()
  const isAtRoute = headersList.get("x-nimimo-at-route") === "1"
  if (!isAtRoute) {
    return <PageNotFound />
  }

  if (!isValidHandle(handle)) {
    return <NotFoundInline />
  }

  // Ensure bio column exists
  await ensureMigrations()

  // Query the database for this identity
  const sql = neon(process.env.DATABASE_URL!)

  // Resolve handle → ownership_id (registry first, then identities fallback)
  let ownershipId: string | null = null
  try {
    const registry = await sql`
      SELECT hr.ownership_id FROM handle_registry hr
      JOIN identities i ON i.ownership_id = hr.ownership_id AND i.status = 'active'
      WHERE hr.handle = ${handle} LIMIT 1
    `
    if (registry.length > 0) {
      ownershipId = registry[0].ownership_id as string
    } else {
      const direct = await sql`
        SELECT ownership_id FROM identities
        WHERE handle = ${handle} AND status = 'active' LIMIT 1
      `
      if (direct.length > 0) ownershipId = direct[0].ownership_id as string
    }
  } catch (error) {
    log.error("Handle resolution error", error)
    return <NotFoundInline />
  }

  if (!ownershipId) {
    return <NotFoundInline />
  }

  // Load identity data by ownership_id
  let result
  try {
    result = await cached(`profile:${ownershipId}`, 60, () => sql`
      SELECT
        i.ownership_id, i.handle, i.created_at, i.bio,
        i.avatar_url, i.profile_template, i.profile_palette, i.badges
      FROM identities i
      WHERE i.ownership_id = ${ownershipId} AND i.status = 'active'
      LIMIT 1
    `)
  } catch (error) {
    log.error("Database query error", error)
    return <NotFoundInline />
  }

  if (result.length === 0) {
    return <NotFoundInline />
  }

  // Get display handle from registry (primary), or fall back to identities.handle
  let displayHandle: string
  try {
    const primaryRow = await sql`
      SELECT handle FROM handle_registry
      WHERE ownership_id = ${ownershipId} AND type = 'primary' LIMIT 1
    `
    displayHandle = primaryRow.length > 0
      ? primaryRow[0].handle as string
      : result[0].handle as string
  } catch {
    displayHandle = result[0].handle as string
  }

  const identity = result[0]
  const profileBio: string | null = identity.bio ?? null
  const profileAvatarUrl: string | null = identity.avatar_url ?? null
  const profileTemplate: string = identity.profile_template ?? "classic"
  const profilePalette: string = identity.profile_palette ?? "default"
  const profileBadges: string[] = Array.isArray(identity.badges) ? identity.badges : []

  const createdDate = new Date(identity.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  let addresses: DerivedAddress[] = []
  try {
    const addressResult = await sql`
      SELECT chain, address
      FROM ownership_public_addresses
      WHERE ownership_id = ${identity.ownership_id}
        AND chain IN ('bitcoin', 'ethereum', 'solana')
      ORDER BY
        CASE chain
          WHEN 'bitcoin' THEN 1
          WHEN 'ethereum' THEN 2
          WHEN 'solana' THEN 3
          ELSE 4
        END
    `

    const chainMetadata: Record<string, { name: string; symbol: string; logo: string }> = {
      bitcoin: { name: "Bitcoin", symbol: "BTC", logo: "/logos/bitcoin.svg" },
      ethereum: { name: "Ethereum", symbol: "ETH", logo: "/logos/ethereum.svg" },
      solana: { name: "Solana", symbol: "SOL", logo: "/logos/solana.svg" },
    }

    addresses = addressResult.map((addr) => ({
      chain: addr.chain,
      address: addr.address,
      name: chainMetadata[addr.chain]?.name || addr.chain,
      symbol: chainMetadata[addr.chain]?.symbol || addr.chain.toUpperCase(),
      logo: chainMetadata[addr.chain]?.logo || "/placeholder.svg",
      derivationPath: "",
    }))
  } catch (error) {
    log.error("Error fetching addresses", error)
  }

  return (
    <div className="min-h-[calc(100svh-3.5rem)] flex flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          name: `@${displayHandle}`,
          url: `${SITE_URL}/@${displayHandle}`,
          description: profileBio || `Send crypto to @${displayHandle} on nimimo`,
          mainEntity: {
            "@type": "Person",
            name: `@${displayHandle}`,
            url: `${SITE_URL}/@${displayHandle}`,
          },
          isPartOf: {
            "@type": "WebSite",
            name: "nimimo",
            url: SITE_URL,
          },
        }}
      />
      <div className="flex-1">
        <ProfileContent
          handle={displayHandle}
          bio={profileBio}
          avatarUrl={profileAvatarUrl}
          ownershipId={identity.ownership_id}
          createdAt={createdDate}
          addresses={addresses}
          template={profileTemplate}
          palette={profilePalette}
          badges={profileBadges}
        />
      </div>
    </div>
  )
}
