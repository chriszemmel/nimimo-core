import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "./auth"
import { sql as getSql, ensureMigrations } from "./db"

/**
 * Returns the authenticated session or a 401 response.
 * Usage:
 *   const auth = await requireAuth()
 *   if (auth.error) return auth.error
 *   const { session } = auth
 */
export async function requireAuth(): Promise<
  | { session: { user: { id: string; email: string } }; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email || !session?.user?.id) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return {
    session: session as { user: { id: string; email: string } },
    error: null,
  }
}

/**
 * Verifies the authenticated user controls the given ownership_id.
 * Returns the session on success or a 403 response on failure.
 *
 * Usage:
 *   const auth = await requireOwnership(ownership_id)
 *   if (auth.error) return auth.error
 */
export async function requireOwnership(ownership_id: string): Promise<
  | { session: { user: { id: string; email: string } }; error: null }
  | { session: null; error: NextResponse }
> {
  const auth = await requireAuth()
  if (auth.error) return auth

  await ensureMigrations()
  const sql = getSql()
  const rows = await sql`
    SELECT 1 FROM ownership_users
    WHERE ownership_id = ${ownership_id} AND user_id = ${auth.session.user.id}
    LIMIT 1
  `

  if (rows.length === 0) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return auth
}
