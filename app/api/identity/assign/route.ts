import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql, ensureMigrations } from "@/lib/db"
import { requireAuth } from "@/lib/auth-guard"
import { identityAssignSchema, validate } from "@/lib/validation"
import { recoverLinkSigner } from "@/lib/identity/link-proof"
import { logger } from "@/lib/logger"

const log = logger("api/identity")

export async function POST(request: NextRequest) {
  const sql = getSql()
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await ensureMigrations()

  try {
    const body = await request.json()
    const parsed = validate(identityAssignSchema, body)
    if (parsed.error) return parsed.error
    const { ownership_id, handle, initial, nonce, signature } = parsed.data

    const userId = auth.session.user.id

    // Atomic claim: only one concurrent request per user_id can win this.
    // Postgres row-level MVCC guarantees exactly one UPDATE observes
    // has_identity=false. See tasks/lessons.md → "Use has_identity as an
    // atomic CAS". Do NOT move this flag-flip to a separate route; the whole
    // point is that the create-and-flag must happen under a single lock.
    const claim = await sql`
      UPDATE users
         SET has_identity = true
       WHERE id = ${userId}
         AND has_identity = false
      RETURNING id
    `

    if (claim.length === 0) {
      // CAS lost. Determine which sub-case we're in:
      //
      // 1. An identities row already exists for the submitted ownership_id
      //    → legitimate rebind or cross-user link (e.g. restore flow where
      //    the user proves they know the seed of an existing ownership).
      //    ownership_users is many-to-many by design, so fall through to
      //    the idempotent INSERTs below to create the link.
      //
      // 2. No identity for this ownership_id AND the caller told us this
      //    was supposed to be its FIRST identity (`initial: true`) → the
      //    caller lost a first-identity race against another tab / device /
      //    strict-mode-remount. Return the user's existing identity so the
      //    client can reconcile its local orphan. No time window here:
      //    `initial: true` is the unambiguous signal that this is a race-
      //    loser, not a deliberate multi-wallet add.
      //
      // 3. No identity, `initial !== true`, and the user has a sibling
      //    created in the last 60 seconds → likely race-loser from a legacy
      //    client that didn't set `initial`. Widened from 2s → 60s because
      //    the prior 2s window was too tight and allowed pairs of
      //    identities to land 2-3s apart in production.
      //
      // 4. No identity, no recent sibling → deliberate "add a new
      //    ownership" (OwnershipPrompt → Create new on a returning user who
      //    has no local ownership). Fall through to the INSERTs.
      const identityExists = await sql`
        SELECT 1 FROM identities WHERE ownership_id = ${ownership_id} LIMIT 1
      `

      if (identityExists.length === 0) {
        // Retry the sibling lookup briefly: the racing winner may have
        // committed its CAS but not yet its ownership_users INSERT.
        let recent: Array<{ identity_id: string; handle: string; ownership_id: string; age_sec: string | number }> = []
        for (let attempt = 0; attempt < 5; attempt++) {
          recent = (await sql`
            SELECT i.identity_id, i.handle, ou.ownership_id,
                   EXTRACT(EPOCH FROM (now() - ou.linked_at)) AS age_sec
              FROM ownership_users ou
              JOIN identities i ON i.ownership_id = ou.ownership_id
             WHERE ou.user_id = ${userId}
             ORDER BY ou.linked_at DESC
             LIMIT 1
          `) as typeof recent
          if (recent.length > 0) break
          if (attempt < 4) await new Promise((r) => setTimeout(r, 100))
        }

        if (recent.length > 0 && (initial === true || Number(recent[0].age_sec) < 60)) {
          // First-identity race-loser - return the winner's identity.
          return NextResponse.json({
            handle: recent[0].handle,
            identity_id: recent[0].identity_id,
            ownership_id: recent[0].ownership_id,
            existed: true,
          })
        }
        // else: `initial` was not set AND sibling is old (or missing) -
        // fall through to create. This is the multi-wallet add path.
      }
      // else: identity exists for this ownership_id - fall through to link.
    }

    // Seed-control proof gate. Linking a user to an ownership that ALREADY
    // has an identity is only allowed when the caller proves they control
    // that ownership's seed - otherwise a session holder could attach
    // themselves to any publicly-known ownership_id. First-time creation
    // (no identity yet) and callers who are already linked skip the gate.
    const alreadyLinked = await sql`
      SELECT 1 FROM ownership_users WHERE ownership_id = ${ownership_id} AND user_id = ${userId} LIMIT 1
    `
    if (alreadyLinked.length === 0) {
      const identityForOwnership = await sql`
        SELECT 1 FROM identities WHERE ownership_id = ${ownership_id} LIMIT 1
      `
      if (identityForOwnership.length > 0) {
        if (!nonce || !signature) {
          return NextResponse.json({ error: "proof_required" }, { status: 403 })
        }

        // Consume the nonce atomically so each challenge is single-use.
        const consumed = await sql`
          DELETE FROM link_challenges
          WHERE ownership_id = ${ownership_id} AND nonce = ${nonce} AND expires_at > now()
          RETURNING nonce
        `
        if (consumed.length === 0) {
          return NextResponse.json({ error: "proof_rejected" }, { status: 403 })
        }

        const signer = recoverLinkSigner(ownership_id, nonce, signature)
        if (!signer) {
          return NextResponse.json({ error: "proof_rejected" }, { status: 403 })
        }

        const match = await sql`
          SELECT 1 FROM ownership_public_addresses
          WHERE ownership_id = ${ownership_id}
            AND chain = 'ethereum'
            AND lower(address) = lower(${signer})
          LIMIT 1
        `
        if (match.length === 0) {
          return NextResponse.json({ error: "proof_rejected" }, { status: 403 })
        }
      }
    }

    // Link the user to this ownership (idempotent)
    await sql`
      INSERT INTO ownership_users (ownership_id, user_id)
      VALUES (${ownership_id}, ${userId})
      ON CONFLICT (ownership_id, user_id) DO NOTHING
    `

    // Atomic insert - ON CONFLICT eliminates the TOCTOU race condition
    try {
      const result = await sql`
        INSERT INTO identities (handle, ownership_id, status)
        VALUES (${handle}, ${ownership_id}, 'active')
        ON CONFLICT (ownership_id) DO NOTHING
        RETURNING identity_id, handle
      `

      if (result.length > 0) {
        return NextResponse.json({
          handle: result[0].handle,
          identity_id: result[0].identity_id,
          ownership_id,
          existed: false,
        })
      }

      // ownership_id already had an identity - return it
      const existing = await sql`
        SELECT handle, identity_id
        FROM identities
        WHERE ownership_id = ${ownership_id}
      `

      return NextResponse.json({
        handle: existing[0].handle,
        identity_id: existing[0].identity_id,
        ownership_id,
        existed: true,
      })
    } catch (insertError: unknown) {
      // Handle unique constraint violation on handle (collision)
      if (insertError instanceof Error && "code" in insertError && (insertError as { code: string }).code === "23505") {
        return NextResponse.json({ error: "collision", message: "Handle already taken" }, { status: 409 })
      }
      throw insertError
    }
  } catch (error) {
    log.error("Identity assignment error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
