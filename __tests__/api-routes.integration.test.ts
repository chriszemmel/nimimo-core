/**
 * Integration tests for API route handlers.
 *
 * Strategy: mock auth guards and database at the module boundary,
 * then call actual route handlers with real Request objects.
 * Tests validation, auth, ownership checks, and response shapes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { signLinkProof } from "@/lib/identity/link-proof"

// Standard BIP-39 test vectors for proving control of an ownership's seed.
const SEED_A =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"
const SEED_B =
  "legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title"

// ── Shared state for mocks ──────────────────────────────────────────────

let authResult: { session: { user: { id: string; email: string } }; error: null }
  | { session: null; error: NextResponse } = {
  session: null,
  error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}

let ownershipResult: typeof authResult = {
  session: null,
  error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
}

const mockDbRows: Record<string, unknown>[] = []

// Query-specific routing for tests that need to distinguish between multiple
// statements in a single request (CAS, sibling lookup, identity lookup, etc.).
// Keys are case-insensitive substrings; first match wins, evaluated in
// insertion order.
let mockQueryOverrides: Array<{ match: string; rows: Record<string, unknown>[] }> = []

const mockSql = (_strings: TemplateStringsArray, ..._values: unknown[]) => {
  const query = _strings.join("?")
  const lower = query.toLowerCase()

  for (const override of mockQueryOverrides) {
    if (lower.includes(override.match.toLowerCase())) {
      return Promise.resolve(override.rows.map(({ __insert: _, ...rest }) => rest))
    }
  }

  if (query.includes("INSERT") && query.includes("ON CONFLICT") && query.includes("DO NOTHING")) {
    // Simulate ON CONFLICT returning no rows (conflict hit) unless rows are marked
    if (mockDbRows.length > 0 && mockDbRows[0]?.__insert === true) {
      return Promise.resolve(mockDbRows.map(({ __insert, ...rest }) => rest))
    }
    return Promise.resolve([])
  }
  return Promise.resolve([...mockDbRows])
}

// ── Module mocks (hoisted) ──────────────────────────────────────────────

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: () => Promise.resolve(authResult),
  requireOwnership: () => Promise.resolve(ownershipResult),
}))

vi.mock("@/lib/db", () => ({
  sql: () => mockSql,
  ensureMigrations: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/adapters/cache", () => ({
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@neondatabase/serverless", () => ({
  neon: () => (_query: string) => Promise.resolve([{ count: 1 }]),
}))

// ── Helpers ──────────────────────────────────────────────────────────────

const VALID_UUID = "11111111-1111-1111-1111-111111111111"
const TEST_USER = { id: "00000000-0000-0000-0000-000000000001", email: "test@example.com" }

function jsonReq(url: string, method: string, body?: unknown): NextRequest {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(new URL(url, "http://localhost:3000"), init)
}

function setAuthenticated() {
  authResult = { session: { user: TEST_USER }, error: null }
}

function setUnauthenticated() {
  authResult = { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
}

function setOwnershipGranted() {
  ownershipResult = { session: { user: TEST_USER }, error: null }
}

function setOwnershipDenied() {
  ownershipResult = { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
}

function setDbRows(rows: Record<string, unknown>[]) {
  mockDbRows.length = 0
  mockDbRows.push(...rows)
}

function setQueryOverrides(overrides: Array<{ match: string; rows: Record<string, unknown>[] }>) {
  mockQueryOverrides = overrides
}

// ═══════════════════════════════════════════════════════════════════════
// Identity Assign
// ═══════════════════════════════════════════════════════════════════════

describe("POST /api/identity/assign", async () => {
  const { POST } = await import("@/app/api/identity/assign/route")

  beforeEach(() => {
    setDbRows([])
    setQueryOverrides([])
    setUnauthenticated()
    setOwnershipDenied()
  })

  // Query overrides are module-global; clear them so later suites (which
  // don't set their own) aren't affected by this suite's routing.
  afterEach(() => setQueryOverrides([]))

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "cool-water",
    }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid handle format", async () => {
    setAuthenticated()
    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "123-bad",
    }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing ownership_id", async () => {
    setAuthenticated()
    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      handle: "cool-water",
    }))
    expect(res.status).toBe(400)
  })

  it("returns existing identity when ownership already has one", async () => {
    setAuthenticated()
    setDbRows([{ handle: "old-handle", identity_id: "existing-id" }])
    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "cool-water",
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.existed).toBe(true)
    expect(data.handle).toBe("old-handle")
  })

  it("creates new identity when no conflict", async () => {
    setAuthenticated()
    setDbRows([{ __insert: true, handle: "cool-water", identity_id: "new-id" }])
    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "cool-water",
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.existed).toBe(false)
    expect(data.handle).toBe("cool-water")
  })

  // Regression: new users were getting two identities created ~2-3s apart
  // because the race-loser reconciliation window was 2s (too tight) and the
  // fallback treated the second call as a "deliberate add new wallet".
  // With `initial: true`, the server reconciles to the winner's identity
  // regardless of age.
  it("reconciles race-loser when initial=true even if sibling is old", async () => {
    setAuthenticated()
    const SIBLING_OWNERSHIP = "22222222-2222-2222-2222-222222222222"
    setQueryOverrides([
      // CAS: UPDATE users returns 0 rows (has_identity was already true)
      { match: "update users", rows: [] },
      // No identity exists for the submitted ownership_id
      { match: "select 1 from identities", rows: [] },
      // Sibling exists from 30 seconds ago - outside the 2s legacy window
      // but MUST still reconcile because `initial: true` is set
      {
        match: "from ownership_users ou",
        rows: [{
          identity_id: "winner-id",
          handle: "winner-handle",
          ownership_id: SIBLING_OWNERSHIP,
          age_sec: 30,
        }],
      },
    ])

    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "loser-handle", initial: true,
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.existed).toBe(true)
    expect(data.handle).toBe("winner-handle")
    expect(data.ownership_id).toBe(SIBLING_OWNERSHIP)
  })

  // Legacy path (no `initial` flag) must still reconcile a sibling created
  // within 60s - widened from the prior 2s window.
  it("reconciles race-loser without initial flag when sibling is under 60s old", async () => {
    setAuthenticated()
    const SIBLING_OWNERSHIP = "33333333-3333-3333-3333-333333333333"
    setQueryOverrides([
      { match: "update users", rows: [] },
      { match: "select 1 from identities", rows: [] },
      {
        match: "from ownership_users ou",
        rows: [{
          identity_id: "winner-id",
          handle: "winner-handle",
          ownership_id: SIBLING_OWNERSHIP,
          age_sec: 15,
        }],
      },
    ])

    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "loser-handle",
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.existed).toBe(true)
    expect(data.handle).toBe("winner-handle")
  })

  // Without `initial`, an old sibling (>60s) means the caller is doing a
  // deliberate multi-wallet add (returning user on OwnershipPrompt) - create.
  it("creates new identity when no initial flag and sibling is old (multi-wallet add)", async () => {
    setAuthenticated()
    setQueryOverrides([
      { match: "update users", rows: [] },
      { match: "select 1 from identities", rows: [] },
      {
        match: "from ownership_users ou",
        rows: [{
          identity_id: "old-id",
          handle: "old-handle",
          ownership_id: "99999999-9999-9999-9999-999999999999",
          age_sec: 3600,
        }],
      },
      // The subsequent INSERTs return the newly created row so the route
      // reports existed:false.
      { match: "insert into identities", rows: [{ handle: "brand-new", identity_id: "new-id" }] },
    ])

    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "brand-new",
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.existed).toBe(false)
    expect(data.handle).toBe("brand-new")
  })

  // ── Seed-control proof gate ───────────────────────────────────────────
  // Linking to an ownership that ALREADY has an identity requires proving
  // control of its seed when the caller isn't already linked.
  const NONCE = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

  it("rejects linking to an existing ownership without proof (403 proof_required)", async () => {
    setAuthenticated()
    setQueryOverrides([
      { match: "update users", rows: [] },                        // CAS lost: caller already has an identity
      { match: "ownership_users where ownership_id", rows: [] },  // caller not linked to this ownership
      { match: "select 1 from identities", rows: [{ n: 1 }] },    // ownership already has an identity
    ])

    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "cool-water",
    }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("proof_required")
  })

  it("rejects a proof whose signer doesn't match a stored address (403 proof_rejected)", async () => {
    setAuthenticated()
    setQueryOverrides([
      { match: "update users", rows: [] },
      { match: "ownership_users where ownership_id", rows: [] },
      { match: "select 1 from identities", rows: [{ n: 1 }] },
      { match: "delete from link_challenges", rows: [{ nonce: NONCE }] }, // nonce consumed
      { match: "ownership_public_addresses", rows: [] },                  // no stored address matches signer
    ])

    const signature = await signLinkProof(SEED_B, VALID_UUID, NONCE)
    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "cool-water", nonce: NONCE, signature,
    }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("proof_rejected")
  })

  it("links to an existing ownership with a valid proof (restore under a new email)", async () => {
    setAuthenticated()
    setQueryOverrides([
      { match: "update users", rows: [{ id: "fresh-user" }] },           // CAS won: caller is a fresh user
      { match: "ownership_users where ownership_id", rows: [] },          // not linked yet
      { match: "select 1 from identities", rows: [{ n: 1 }] },            // ownership already has an identity
      { match: "delete from link_challenges", rows: [{ nonce: NONCE }] }, // nonce consumed
      { match: "ownership_public_addresses", rows: [{ n: 1 }] },          // signer matches the stored ETH address
      { match: "select handle, identity_id", rows: [{ handle: "owner-handle", identity_id: "owner-id" }] },
    ])

    const signature = await signLinkProof(SEED_A, VALID_UUID, NONCE)
    const res = await POST(jsonReq("/api/identity/assign", "POST", {
      ownership_id: VALID_UUID, handle: "cool-water", nonce: NONCE, signature,
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.existed).toBe(true)
    expect(data.handle).toBe("owner-handle")
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Identity Lookup (public, no auth)
// ═══════════════════════════════════════════════════════════════════════

describe("GET /api/identity/lookup", async () => {
  const { GET } = await import("@/app/api/identity/lookup/route")

  beforeEach(() => setDbRows([]))

  it("returns found:false for unknown handle", async () => {
    const res = await GET(new Request("http://localhost:3000/api/identity/lookup?handle=unknown-handle"))
    expect(res.status).toBe(200)
    expect((await res.json()).found).toBe(false)
  })

  it("returns 400 for empty handle", async () => {
    const res = await GET(new Request("http://localhost:3000/api/identity/lookup?handle="))
    expect(res.status).toBe(400)
  })

  it("returns identity when handle exists", async () => {
    setDbRows([{ handle: "cool-water", ownership_id: VALID_UUID, avatar_url: null }])
    const res = await GET(new Request("http://localhost:3000/api/identity/lookup?handle=cool-water"))
    const data = await res.json()
    expect(data.found).toBe(true)
    expect(data.handle).toBe("cool-water")
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Identity By-Address (public, no auth)
// ═══════════════════════════════════════════════════════════════════════

describe("GET /api/identity/by-address", async () => {
  const { GET } = await import("@/app/api/identity/by-address/route")

  beforeEach(() => setDbRows([]))

  it("returns found:false for unknown address", async () => {
    const res = await GET(new Request("http://localhost:3000/api/identity/by-address?address=0x1234567890abcdef1234567890abcdef12345678"))
    expect((await res.json()).found).toBe(false)
  })

  it("returns 400 for empty address", async () => {
    const res = await GET(new Request("http://localhost:3000/api/identity/by-address?address="))
    expect(res.status).toBe(400)
  })

  it("returns handle when address is found", async () => {
    setDbRows([{ handle: "cool-water", avatar_url: null }])
    const res = await GET(new Request("http://localhost:3000/api/identity/by-address?address=0x1234567890abcdef1234567890abcdef12345678"))
    const data = await res.json()
    expect(data.found).toBe(true)
    expect(data.handle).toBe("cool-water")
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Batch Address Lookup
// ═══════════════════════════════════════════════════════════════════════

describe("POST /api/identity/by-addresses", async () => {
  const { POST } = await import("@/app/api/identity/by-addresses/route")

  beforeEach(() => setDbRows([]))

  it("returns 400 for empty addresses array", async () => {
    const res = await POST(jsonReq("http://localhost:3000/api/identity/by-addresses", "POST", { addresses: [] }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing addresses field", async () => {
    const res = await POST(jsonReq("http://localhost:3000/api/identity/by-addresses", "POST", {}))
    expect(res.status).toBe(400)
  })

  it("returns 400 for too many addresses", async () => {
    const addrs = Array.from({ length: 51 }, (_, i) => `0x${i.toString(16).padStart(40, "0")}`)
    const res = await POST(jsonReq("http://localhost:3000/api/identity/by-addresses", "POST", { addresses: addrs }))
    expect(res.status).toBe(400)
  })

  it("returns empty results for unknown addresses", async () => {
    const res = await POST(jsonReq("http://localhost:3000/api/identity/by-addresses", "POST", {
      addresses: ["0x1234567890abcdef1234567890abcdef12345678"],
    }))
    const data = await res.json()
    expect(data.results).toEqual({})
  })

  it("returns results for found addresses", async () => {
    setDbRows([{ address: "0xabc", handle: "cool-water", avatar_url: null, ownership_id: VALID_UUID }])
    const res = await POST(jsonReq("http://localhost:3000/api/identity/by-addresses", "POST", {
      addresses: ["0xABC"],
    }))
    const data = await res.json()
    expect(data.results["0xabc"]).toBeDefined()
    expect(data.results["0xabc"].handle).toBe("cool-water")
  })

  it("does not require auth", async () => {
    setUnauthenticated()
    const res = await POST(jsonReq("http://localhost:3000/api/identity/by-addresses", "POST", {
      addresses: ["0x1234567890abcdef1234567890abcdef12345678"],
    }))
    expect(res.status).not.toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Update Bio (ownership-protected)
// ═══════════════════════════════════════════════════════════════════════

describe("PATCH /api/identity/update-bio", async () => {
  const { PATCH } = await import("@/app/api/identity/update-bio/route")

  beforeEach(() => {
    setDbRows([])
    setUnauthenticated()
    setOwnershipDenied()
  })

  it("returns 403 when user does not own the ownership_id", async () => {
    setOwnershipDenied()
    const res = await PATCH(jsonReq("/api/identity/update-bio", "PATCH", {
      ownership_id: VALID_UUID, bio: "Hello",
    }))
    expect(res.status).toBe(403)
  })

  it("returns 400 for bio exceeding 160 chars", async () => {
    setOwnershipGranted()
    const res = await PATCH(jsonReq("/api/identity/update-bio", "PATCH", {
      ownership_id: VALID_UUID, bio: "x".repeat(300),
    }))
    expect(res.status).toBe(400)
  })

  it("updates bio successfully", async () => {
    setOwnershipGranted()
    setDbRows([{ handle: "cool-water", bio: "New bio" }])
    const res = await PATCH(jsonReq("/api/identity/update-bio", "PATCH", {
      ownership_id: VALID_UUID, bio: "New bio",
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.handle).toBe("cool-water")
    expect(data.bio).toBe("New bio")
  })

  it("returns 404 when no identity found for ownership", async () => {
    setOwnershipGranted()
    setDbRows([])
    const res = await PATCH(jsonReq("/api/identity/update-bio", "PATCH", {
      ownership_id: VALID_UUID, bio: "Hello",
    }))
    expect(res.status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Address Store (ownership-protected)
// ═══════════════════════════════════════════════════════════════════════

describe("POST /api/addresses/store", async () => {
  const { POST } = await import("@/app/api/addresses/store/route")

  beforeEach(() => {
    setDbRows([])
    setUnauthenticated()
    setOwnershipDenied()
  })

  it("returns 403 when user does not own the ownership_id", async () => {
    const res = await POST(jsonReq("/api/addresses/store", "POST", {
      ownership_id: VALID_UUID, ownership_version: "1",
      addresses: [{ chain: "bitcoin", address: "bc1qtest" }],
    }))
    expect(res.status).toBe(403)
  })

  it("returns 400 for invalid chain", async () => {
    setOwnershipGranted()
    const res = await POST(jsonReq("/api/addresses/store", "POST", {
      ownership_id: VALID_UUID, ownership_version: "1",
      addresses: [{ chain: "dogecoin", address: "Dtest" }],
    }))
    expect(res.status).toBe(400)
  })

  it("stores addresses successfully", async () => {
    setOwnershipGranted()
    const res = await POST(jsonReq("/api/addresses/store", "POST", {
      ownership_id: VALID_UUID, ownership_version: "1",
      addresses: [
        { chain: "bitcoin", address: "bc1qtest" },
        { chain: "ethereum", address: "0xtest" },
      ],
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Public Resolution API v1
// ═══════════════════════════════════════════════════════════════════════

describe("GET /api/v1/resolve", async () => {
  const { GET, OPTIONS } = await import("@/app/api/v1/resolve/route")

  beforeEach(() => setDbRows([]))

  it("returns CORS headers on OPTIONS preflight", async () => {
    const res = await OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET")
  })

  it("returns 400 for invalid handle", async () => {
    const res = await GET(new Request("http://localhost:3000/api/v1/resolve?handle=123-bad"))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("invalid_handle")
  })

  it("returns 400 for unsupported chain", async () => {
    const res = await GET(new Request("http://localhost:3000/api/v1/resolve?handle=cool-water&chain=dogecoin"))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("invalid_chain")
  })

  it("returns 404 for unknown handle", async () => {
    setDbRows([])
    const res = await GET(new Request("http://localhost:3000/api/v1/resolve?handle=unknown-handle"))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("not_found")
  })

  it("returns all addresses for a known handle", async () => {
    setDbRows([{ ownership_id: VALID_UUID }])
    const res = await GET(new Request("http://localhost:3000/api/v1/resolve?handle=cool-water"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.handle).toBe("cool-water")
    expect(data.addresses).toBeDefined()
    // CORS header present on success too
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  it("returns single chain address when chain filter is used", async () => {
    setDbRows([{ ownership_id: VALID_UUID }])
    const res = await GET(new Request("http://localhost:3000/api/v1/resolve?handle=cool-water&chain=bitcoin"))
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Wallet Broadcast - Solana / Ethereum / Bitcoin
//
// Strategy: mock global.fetch to control the JSON-RPC / blockstream
// responses the route handlers see. We do NOT hit any real chain. The
// goal is to verify auth gate, request shape (correct JSON-RPC method
// and params), success-path response shape, definitive-error mapping,
// and the all-endpoints-failed fallback. End-to-end correctness against
// real testnets is out of scope for these tests.
// ═══════════════════════════════════════════════════════════════════════

type FetchStub = (url: string, init?: RequestInit) => Promise<Response>

function stubFetchOnce(impl: FetchStub) {
  vi.stubGlobal("fetch", vi.fn(impl))
}

function stubFetchSequence(impls: FetchStub[]) {
  let i = 0
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const next = impls[Math.min(i, impls.length - 1)]
      i++
      return next(url, init)
    }),
  )
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

function textResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/plain" },
    ...init,
  })
}

describe("POST /api/wallet/broadcast (Solana)", async () => {
  const { POST } = await import("@/app/api/wallet/broadcast/route")
  const VALID_BASE64 = "AQID" // arbitrary, only validated as non-empty

  beforeEach(() => {
    setUnauthenticated()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(jsonReq("/api/wallet/broadcast", "POST", { tx: VALID_BASE64 }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid body (missing tx)", async () => {
    setAuthenticated()
    const res = await POST(jsonReq("/api/wallet/broadcast", "POST", {}))
    expect(res.status).toBe(400)
  })

  it("returns the signature when the first reachable RPC accepts the tx", async () => {
    setAuthenticated()
    stubFetchOnce(async () =>
      jsonResponse({ jsonrpc: "2.0", id: 1, result: "5xyzSignature" }),
    )
    const res = await POST(jsonReq("/api/wallet/broadcast", "POST", { tx: VALID_BASE64 }))
    expect(res.status).toBe(200)
    expect((await res.json()).signature).toBe("5xyzSignature")
  })

  it("sends the correct sendTransaction JSON-RPC payload", async () => {
    setAuthenticated()
    let captured: { url: string; body: unknown } | null = null
    stubFetchOnce(async (url, init) => {
      captured = { url, body: JSON.parse(String(init?.body)) }
      return jsonResponse({ jsonrpc: "2.0", id: 1, result: "sig" })
    })
    await POST(jsonReq("/api/wallet/broadcast", "POST", { tx: VALID_BASE64 }))
    expect(captured).not.toBeNull()
    const body = captured!.body as { method: string; params: unknown[] }
    expect(body.method).toBe("sendTransaction")
    expect(body.params[0]).toBe(VALID_BASE64)
    expect(body.params[1]).toMatchObject({ encoding: "base64" })
  })

  it("maps 'simulation failed' RPC error to a sanitized 400", async () => {
    setAuthenticated()
    stubFetchOnce(async () =>
      jsonResponse({ jsonrpc: "2.0", id: 1, error: { message: "Transaction simulation failed: insufficient lamports" } }),
    )
    const res = await POST(jsonReq("/api/wallet/broadcast", "POST", { tx: VALID_BASE64 }))
    expect(res.status).toBe(400)
    const data = await res.json()
    // Sanitized - must not echo the raw RPC string verbatim
    expect(data.error).not.toContain("lamports")
    expect(data.error.toLowerCase()).toContain("simulation failed")
  })

  it("falls back to the next endpoint on a transient error and succeeds", async () => {
    setAuthenticated()
    stubFetchSequence([
      async () => jsonResponse({ jsonrpc: "2.0", id: 1, error: { message: "transient: blockhash not found" } }),
      async () => jsonResponse({ jsonrpc: "2.0", id: 1, result: "fallback-sig" }),
    ])
    const res = await POST(jsonReq("/api/wallet/broadcast", "POST", { tx: VALID_BASE64 }))
    expect(res.status).toBe(200)
    expect((await res.json()).signature).toBe("fallback-sig")
  })

  it("returns 502 when every endpoint fails", async () => {
    setAuthenticated()
    stubFetchOnce(async () => {
      throw new Error("network down")
    })
    const res = await POST(jsonReq("/api/wallet/broadcast", "POST", { tx: VALID_BASE64 }))
    expect(res.status).toBe(502)
  })
})

describe("POST /api/wallet/broadcast-eth", async () => {
  const { POST } = await import("@/app/api/wallet/broadcast-eth/route")
  const VALID_HEX = "0xdeadbeef"

  beforeEach(() => {
    setUnauthenticated()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(jsonReq("/api/wallet/broadcast-eth", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(401)
  })

  it("returns the tx hash on success", async () => {
    setAuthenticated()
    stubFetchOnce(async () =>
      jsonResponse({ jsonrpc: "2.0", id: 1, result: "0xabc123" }),
    )
    const res = await POST(jsonReq("/api/wallet/broadcast-eth", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(200)
    expect((await res.json()).hash).toBe("0xabc123")
  })

  it("sends the correct eth_sendRawTransaction payload", async () => {
    setAuthenticated()
    let captured: { method: string; params: unknown[] } | null = null
    stubFetchOnce(async (_url, init) => {
      captured = JSON.parse(String(init?.body)) as { method: string; params: unknown[] }
      return jsonResponse({ jsonrpc: "2.0", id: 1, result: "0xhash" })
    })
    await POST(jsonReq("/api/wallet/broadcast-eth", "POST", { tx: VALID_HEX }))
    expect(captured).not.toBeNull()
    expect(captured!.method).toBe("eth_sendRawTransaction")
    expect(captured!.params[0]).toBe(VALID_HEX)
  })

  it("maps 'insufficient funds' to a sanitized 400", async () => {
    setAuthenticated()
    stubFetchOnce(async () =>
      jsonResponse({ jsonrpc: "2.0", id: 1, error: { message: "insufficient funds for gas * price + value" } }),
    )
    const res = await POST(jsonReq("/api/wallet/broadcast-eth", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.toLowerCase()).toContain("insufficient funds")
  })

  it("maps 'nonce too low' to a 400 retry message", async () => {
    setAuthenticated()
    stubFetchOnce(async () =>
      jsonResponse({ jsonrpc: "2.0", id: 1, error: { message: "nonce too low: have 5 want 7" } }),
    )
    const res = await POST(jsonReq("/api/wallet/broadcast-eth", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.toLowerCase()).toContain("retry")
  })

  it("returns 502 when every endpoint fails", async () => {
    setAuthenticated()
    stubFetchOnce(async () => {
      throw new Error("network down")
    })
    const res = await POST(jsonReq("/api/wallet/broadcast-eth", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(502)
  })
})

describe("POST /api/wallet/broadcast-btc", async () => {
  const { POST } = await import("@/app/api/wallet/broadcast-btc/route")
  const VALID_HEX = "0200000001abcd"

  beforeEach(() => {
    setUnauthenticated()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(jsonReq("/api/wallet/broadcast-btc", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(401)
  })

  it("returns the txid from Blockstream on success", async () => {
    setAuthenticated()
    stubFetchOnce(async () => textResponse("abc123txid\n", { status: 200 }))
    const res = await POST(jsonReq("/api/wallet/broadcast-btc", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(200)
    expect((await res.json()).txid).toBe("abc123txid")
  })

  it("posts the raw hex tx as text/plain to Blockstream", async () => {
    setAuthenticated()
    let captured: { url: string; body: string; contentType: string | null } | null = null
    stubFetchOnce(async (url, init) => {
      captured = {
        url,
        body: String(init?.body),
        contentType: new Headers(init?.headers).get("Content-Type"),
      }
      return textResponse("txid", { status: 200 })
    })
    await POST(jsonReq("/api/wallet/broadcast-btc", "POST", { tx: VALID_HEX }))
    expect(captured).not.toBeNull()
    expect(captured!.url).toContain("blockstream.info")
    expect(captured!.body).toBe(VALID_HEX)
    expect(captured!.contentType).toBe("text/plain")
  })

  it("returns 400 with the rejection reason when Blockstream returns 400", async () => {
    setAuthenticated()
    stubFetchOnce(async () => textResponse("bad-txns-inputs-missingorspent", { status: 400 }))
    const res = await POST(jsonReq("/api/wallet/broadcast-btc", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("bad-txns-inputs-missingorspent")
  })

  it("falls back to Blockcypher when Blockstream throws", async () => {
    setAuthenticated()
    stubFetchSequence([
      async () => {
        throw new Error("DNS failure")
      },
      async () => jsonResponse({ hash: "fallback-txid" }, { status: 200 }),
    ])
    const res = await POST(jsonReq("/api/wallet/broadcast-btc", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(200)
    expect((await res.json()).txid).toBe("fallback-txid")
  })

  it("returns 502 when both Blockstream and Blockcypher fail", async () => {
    setAuthenticated()
    stubFetchOnce(async () => {
      throw new Error("network down")
    })
    const res = await POST(jsonReq("/api/wallet/broadcast-btc", "POST", { tx: VALID_HEX }))
    expect(res.status).toBe(502)
  })
})
