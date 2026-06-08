import { z } from "zod"
import { NextResponse } from "next/server"
import { getAllTemplates } from "@/components/profile/templates"

// ─── Shared field schemas ───────────────────────────────────────────────

/** UUID v4 ownership ID */
const ownershipId = z.string().uuid("Invalid ownership_id format")

/** Lowercase handle: single word or hyphenated (e.g. chris, cool-water) */
const handle = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "Invalid handle format. Must be lowercase letters, numbers, and hyphens")

/** Non-empty hex string (BTC/ETH transactions) */
const hexTx = z
  .string()
  .min(1, "Transaction cannot be empty")
  .regex(/^(0x)?[0-9a-fA-F]+$/, "Transaction must be hex-encoded")

/** Non-empty base64 string (Solana transactions) */
const base64Tx = z
  .string()
  .min(1, "Transaction cannot be empty")

/** Blockchain chain identifier */
const chain = z.enum(["bitcoin", "ethereum", "solana"])

/** Blockchain address (format varies by chain, validated loosely here) */
const address = z.string().min(1, "Address cannot be empty").max(256)

// ─── POST body schemas ──────────────────────────────────────────────────

export const identityAssignSchema = z.object({
  ownership_id: ownershipId,
  handle,
  // Set by the auto-new-user path in OwnershipProvider so the server can
  // recognize a lost-CAS result as a race-loser and reconcile to the
  // winner's identity without any time-window guessing. Absent / false on
  // explicit "add another wallet" flows (OwnershipPrompt) so those still
  // create a new identity.
  initial: z.boolean().optional(),
  // Seed-control proof, only required when linking to an ownership that
  // already has an identity (see link-challenge). Signed over public data.
  nonce: z.string().min(1).max(128).optional(),
  signature: z.string().min(1).max(256).optional(),
})

export const linkChallengeSchema = z.object({
  ownership_id: ownershipId,
})

export const siteAuthSchema = z.object({
  password: z.string().max(256, "Password too long"),
})

export const broadcastBtcSchema = z.object({
  tx: hexTx,
  recipientAddress: z.string().max(256).optional(),
  senderAddress: z.string().max(256).optional(),
})

export const broadcastSolSchema = z.object({
  tx: base64Tx,
  recipientAddress: z.string().max(256).optional(),
  senderAddress: z.string().max(256).optional(),
})

export const broadcastEthSchema = z.object({
  tx: hexTx,
  recipientAddress: z.string().max(256).optional(),
  senderAddress: z.string().max(256).optional(),
})

export const addressStoreSchema = z.object({
  ownership_id: ownershipId,
  ownership_version: z.string().min(1, "ownership_version is required"),
  addresses: z
    .array(
      z.object({
        chain,
        address,
      })
    )
    .min(1, "At least one address is required"),
})

export const bioUpdateSchema = z.object({
  bio: z.string().max(160, "Bio must be 160 characters or less").trim(),
  ownership_id: z.string().uuid("Invalid ownership ID"),
})

export const templateUpdateSchema = z.object({
  template: z.string().refine(
    (val) => getAllTemplates().some((t) => t.id === val),
    { message: "Invalid template" },
  ),
  ownership_id: z.string().uuid("Invalid ownership ID"),
})

export const paletteUpdateSchema = z.object({
  palette: z.enum(["default", "ember", "green", "gold", "purple", "rose", "ice", "sunset", "midnight"], {
    errorMap: () => ({ message: "Invalid palette" }),
  }),
  ownership_id: z.string().uuid("Invalid ownership ID"),
})

// ─── Intent schemas ─────────────────────────────────────────────────────

export const createIntentSchema = z.object({
  from: z.string().max(256).optional(),
  to: z.string().min(1, "Recipient handle is required").max(100),
  chain: chain,
  asset: z.enum(["BTC", "ETH", "SOL"]).optional(),
  amount: z.string().min(1, "Amount is required").regex(/^\d+(\.\d+)?$/, "Amount must be a valid number"),
  memo: z.string().max(500).optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
})

export const updateIntentSchema = z.object({
  status: z.enum(["signed", "completed", "cancelled"]),
  tx_hash: z.string().min(1).max(256).optional(),
}).refine(
  (data) => {
    if (data.status === "completed" && !data.tx_hash) return false
    return true
  },
  { message: "tx_hash is required when status is completed" },
)

// ─── GET query param schemas ────────────────────────────────────────────

export const handleLookupSchema = z.object({
  handle: z.string().min(1).max(100).transform((s) => s.toLowerCase().trim()),
})

export const addressLookupSchema = z.object({
  address: z.string().min(1).max(256).transform((s) => s.trim()),
})

/** POST body for batch address lookup */
export const batchAddressLookupSchema = z.object({
  addresses: z
    .array(z.string().min(1, "Address cannot be empty").max(256))
    .min(1, "At least one address is required")
    .max(50, "Maximum 50 addresses per request"),
})

export const ownershipIdQuerySchema = z.object({
  ownership_id: ownershipId,
})

export const addressQuerySchema = z.object({
  address: z.string().min(1, "Missing address").max(256, "Address too long"),
})

export const avatarQuerySchema = z.object({
  seed: z.string().min(1, "seed required").max(256),
  bg: z.string().max(32).optional(),
})

// ─── Helper ─────────────────────────────────────────────────────────────

/**
 * Parse and validate data with a Zod schema.
 * Returns `{ data }` on success or `{ error: NextResponse }` on failure.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { data: T; error?: never } | { data?: never; error: NextResponse } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { data: result.data }
  }
  const message = result.error.issues.map((i) => i.message).join("; ")
  return {
    error: NextResponse.json(
      { error: "Validation failed", details: message },
      { status: 400 }
    ),
  }
}
