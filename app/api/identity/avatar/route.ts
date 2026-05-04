import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql, ensureMigrations } from "@/lib/db"
import { requireOwnership } from "@/lib/auth-guard"
import { uploadAvatar, deleteAvatar } from "@/lib/r2"
import { logger } from "@/lib/logger"
import { invalidateCache } from "@/lib/adapters/cache"

const log = logger("api/identity")

const MAX_BODY = 500_000 // ~500KB base64 ≈ ~375KB JPEG, plenty for 250x250

export async function PUT(request: NextRequest) {
  await ensureMigrations()
  const db = getSql()

  try {
    const body = await request.json()
    const { ownership_id, image } = body

    if (!ownership_id || typeof ownership_id !== "string") {
      return NextResponse.json({ error: "Missing ownership_id" }, { status: 400 })
    }

    const auth = await requireOwnership(ownership_id)
    if (auth.error) return auth.error
    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 })
    }
    if (image.length > MAX_BODY) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 })
    }

    // Verify identity exists
    const identity = await db`
      SELECT ownership_id, handle FROM identities WHERE ownership_id = ${ownership_id} LIMIT 1
    `
    if (identity.length === 0) {
      return NextResponse.json({ error: "Identity not found" }, { status: 404 })
    }

    // Decode base64 and validate image format
    const buffer = Buffer.from(image, "base64")

    // Validate JPEG or PNG magic bytes
    const isJPEG = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    const isPNG =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a

    if (!isJPEG && !isPNG) {
      return NextResponse.json({ error: "Invalid image format. Only JPEG and PNG are accepted." }, { status: 400 })
    }

    const url = await uploadAvatar(ownership_id, buffer)

    // Store URL in DB
    await db`
      UPDATE identities SET avatar_url = ${url} WHERE ownership_id = ${ownership_id}
    `

    await invalidateCache(`profile:${ownership_id}`)
    return NextResponse.json({ avatar_url: url })
  } catch (error) {
    log.error("Upload error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  await ensureMigrations()
  const db = getSql()

  try {
    const { searchParams } = new URL(request.url)
    const ownership_id = searchParams.get("ownership_id")

    if (!ownership_id) {
      return NextResponse.json({ error: "Missing ownership_id" }, { status: 400 })
    }

    const auth = await requireOwnership(ownership_id)
    if (auth.error) return auth.error

    // Verify identity exists and has avatar
    const identity = await db`
      SELECT handle, avatar_url FROM identities WHERE ownership_id = ${ownership_id} LIMIT 1
    `
    if (identity.length === 0) {
      return NextResponse.json({ error: "Identity not found" }, { status: 404 })
    }

    if (identity[0].avatar_url) {
      // Clear DB first (user-facing), then clean up R2 (best-effort)
      await db`
        UPDATE identities SET avatar_url = NULL WHERE ownership_id = ${ownership_id}
      `
      try {
        await deleteAvatar(ownership_id)
      } catch (e) {
        log.error("R2 delete failed (non-fatal)", e)
      }
    }

    await invalidateCache(`profile:${ownership_id}`)
    return NextResponse.json({ avatar_url: null })
  } catch (error) {
    log.error("Delete error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
