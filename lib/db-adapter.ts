import type { Adapter } from "next-auth/adapters"
import { sql as getSql } from "@/lib/db"

export const NeonAdapter: Adapter = {
  async createUser(user: { email?: string | null; name?: string | null; image?: string | null; emailVerified?: Date | null }) {
    if (!user.email) {
      throw new Error("Email is required to create a user")
    }

    const sql = getSql()
    const result = await sql`
      INSERT INTO users (email, created_at, updated_at)
      VALUES (${user.email}, NOW(), NOW())
      RETURNING id, email, created_at as "createdAt"
    `

    return {
      id: result[0].id,
      email: result[0].email!,
      emailVerified: null,
    }
  },

  async getUser(id) {
    const sql = getSql()
    const result = await sql`
      SELECT id, email FROM users WHERE id = ${id}
    `
    if (!result.length) return null
    return {
      id: result[0].id,
      email: result[0].email!,
      emailVerified: null,
    }
  },

  async getUserByEmail(email) {
    const sql = getSql()
    const result = await sql`
      SELECT id, email FROM users WHERE email = ${email}
    `
    if (!result.length) return null

    return {
      id: result[0].id,
      email: result[0].email!,
      emailVerified: null,
    }
  },

  async getUserByAccount({ providerAccountId, provider }) {
    const sql = getSql()
    const result = await sql`
      SELECT u.id, u.email
      FROM users u
      JOIN accounts a ON u.id = a.user_id
      WHERE a.provider_account_id = ${providerAccountId}
      AND a.provider = ${provider}
    `
    if (!result.length) return null

    return {
      id: result[0].id,
      email: result[0].email!,
      emailVerified: null,
    }
  },

  async updateUser(user) {
    const sql = getSql()
    const updates: string[] = []
    const values: unknown[] = []
    let paramCount = 1

    if (user.email !== undefined) {
      updates.push(`email = $${paramCount++}`)
      values.push(user.email)
    }

    updates.push(`updated_at = NOW()`)

    if (updates.length === 1) {
      // Only updated_at, no actual changes
      const result = await sql`SELECT id, email FROM users WHERE id = ${user.id}`
      return {
        id: result[0].id,
        email: result[0].email!,
        emailVerified: null,
      }
    }

    values.push(user.id)
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, email`

    const result = await sql(query, values)

    return {
      id: result[0].id,
      email: result[0].email!,
      emailVerified: null,
    }
  },

  async deleteUser(userId) {
    const sql = getSql()
    await sql`DELETE FROM users WHERE id = ${userId}`
  },

  async linkAccount(account: { userId: string; type: string; provider: string; providerAccountId: string; refresh_token?: string | null; access_token?: string | null; expires_at?: number | null; token_type?: string | null; scope?: string | null; id_token?: string | null; session_state?: string | null }) {
    const sql = getSql()
    await sql`
      INSERT INTO accounts (
        user_id, type, provider, provider_account_id,
        refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
      )
      VALUES (
        ${account.userId}, ${account.type}, ${account.provider}, ${account.providerAccountId},
        ${account.refresh_token || null}, ${account.access_token || null}, ${account.expires_at || null},
        ${account.token_type || null}, ${account.scope || null}, ${account.id_token || null}, ${account.session_state || null}
      )
    `
  },

  async unlinkAccount({ providerAccountId, provider }) {
    const sql = getSql()
    await sql`
      DELETE FROM accounts
      WHERE provider_account_id = ${providerAccountId}
      AND provider = ${provider}
    `
  },

  async createSession({ sessionToken, userId, expires }) {
    const sql = getSql()
    await sql`
      INSERT INTO sessions (session_token, user_id, expires)
      VALUES (${sessionToken}, ${userId}, ${expires.toISOString()})
    `

    // Update last_login_at here - session creation means login actually succeeded
    await sql`
      UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ${userId}
    `

    return { sessionToken, userId, expires }
  },

  async getSessionAndUser(sessionToken) {
    const sql = getSql()
    const result = await sql`
      SELECT s.session_token as "sessionToken", s.user_id as "userId", s.expires,
             u.id, u.email
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ${sessionToken}
    `
    if (!result.length) return null

    const { sessionToken: token, userId, expires, id, email } = result[0]
    return {
      session: {
        sessionToken: token,
        userId,
        expires: new Date(expires),
      },
      user: {
        id,
        email: email!,
        emailVerified: null,
      },
    }
  },

  async updateSession({ sessionToken, expires }) {
    const sql = getSql()
    const result = await sql`
      UPDATE sessions
      SET expires = ${expires ? expires.toISOString() : null}, updated_at = NOW()
      WHERE session_token = ${sessionToken}
      RETURNING session_token as "sessionToken", user_id as "userId", expires
    `
    if (!result.length) return null
    return {
      sessionToken: result[0].sessionToken,
      userId: result[0].userId,
      expires: new Date(result[0].expires),
    }
  },

  async deleteSession(sessionToken) {
    const sql = getSql()
    await sql`DELETE FROM sessions WHERE session_token = ${sessionToken}`
  },

  async createVerificationToken({ identifier, expires, token }) {
    const sql = getSql()
    await sql`
      INSERT INTO verification_tokens (identifier, token, expires)
      VALUES (${identifier}, ${token}, ${expires.toISOString()})
    `
    return { identifier, token, expires }
  },

  async useVerificationToken({ identifier, token }) {
    const sql = getSql()
    const result = await sql`
      DELETE FROM verification_tokens
      WHERE identifier = ${identifier} AND token = ${token}
      RETURNING identifier, token, expires
    `
    if (!result.length) return null
    return {
      identifier: result[0].identifier,
      token: result[0].token,
      expires: new Date(result[0].expires),
    }
  },
}
