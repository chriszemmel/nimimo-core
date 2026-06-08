import {
  identityAssignSchema,
  siteAuthSchema,
  broadcastBtcSchema,
  broadcastSolSchema,
  broadcastEthSchema,
  addressStoreSchema,
  bioUpdateSchema,
  handleLookupSchema,
} from "@/lib/validation"

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

describe("identityAssignSchema", () => {
  it("accepts valid handle + UUID", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "cool-water" })
    expect(result.success).toBe(true)
  })

  it("accepts single-word handle", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "alpha" })
    expect(result.success).toBe(true)
  })

  it("accepts multi-segment handle", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "cool-water-fox" })
    expect(result.success).toBe(true)
  })

  it("accepts handle with numbers", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "alpha2" })
    expect(result.success).toBe(true)
  })

  it("rejects handle starting with number", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "1bad" })
    expect(result.success).toBe(false)
  })

  it("rejects handle starting with hyphen", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "-bad" })
    expect(result.success).toBe(false)
  })

  it("rejects uppercase handle", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "Bad" })
    expect(result.success).toBe(false)
  })

  it("rejects trailing hyphen", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "bad-" })
    expect(result.success).toBe(false)
  })

  it("rejects consecutive hyphens", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "bad--name" })
    expect(result.success).toBe(false)
  })

  it("rejects special characters", () => {
    expect(identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "bad_name" }).success).toBe(false)
    expect(identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "bad.name" }).success).toBe(false)
    expect(identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "bad name" }).success).toBe(false)
  })

  it("rejects non-UUID ownership_id", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: "not-a-uuid", handle: "cool" })
    expect(result.success).toBe(false)
  })

  it("accepts optional initial flag", () => {
    const withFlag = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "cool-water", initial: true })
    expect(withFlag.success).toBe(true)
    const withoutFlag = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "cool-water" })
    expect(withoutFlag.success).toBe(true)
  })

  it("rejects non-boolean initial", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "cool-water", initial: "yes" })
    expect(result.success).toBe(false)
  })

  it("accepts optional nonce + signature", () => {
    const result = identityAssignSchema.safeParse({
      ownership_id: VALID_UUID,
      handle: "cool-water",
      nonce: "a1b2c3",
      signature: "0xabc123",
    })
    expect(result.success).toBe(true)
  })

  it("still accepts a payload without nonce/signature", () => {
    const result = identityAssignSchema.safeParse({ ownership_id: VALID_UUID, handle: "cool-water" })
    expect(result.success).toBe(true)
  })
})

describe("broadcastBtcSchema / broadcastEthSchema", () => {
  it("accepts valid hex", () => {
    expect(broadcastBtcSchema.safeParse({ tx: "deadbeef" }).success).toBe(true)
    expect(broadcastEthSchema.safeParse({ tx: "deadbeef" }).success).toBe(true)
  })

  it("accepts hex with 0x prefix", () => {
    expect(broadcastBtcSchema.safeParse({ tx: "0xdeadbeef" }).success).toBe(true)
    expect(broadcastEthSchema.safeParse({ tx: "0xdeadbeef" }).success).toBe(true)
  })

  it("rejects empty tx", () => {
    expect(broadcastBtcSchema.safeParse({ tx: "" }).success).toBe(false)
    expect(broadcastEthSchema.safeParse({ tx: "" }).success).toBe(false)
  })

  it("rejects non-hex characters", () => {
    expect(broadcastBtcSchema.safeParse({ tx: "zzzz" }).success).toBe(false)
    expect(broadcastEthSchema.safeParse({ tx: "xyz123" }).success).toBe(false)
  })
})

describe("broadcastSolSchema", () => {
  it("accepts non-empty base64", () => {
    expect(broadcastSolSchema.safeParse({ tx: "SGVsbG8=" }).success).toBe(true)
  })

  it("rejects empty tx", () => {
    expect(broadcastSolSchema.safeParse({ tx: "" }).success).toBe(false)
  })
})

describe("addressStoreSchema", () => {
  it("accepts valid multi-address payload", () => {
    const result = addressStoreSchema.safeParse({
      ownership_id: VALID_UUID,
      ownership_version: "v1",
      addresses: [
        { chain: "bitcoin", address: "bc1qtest" },
        { chain: "ethereum", address: "0xtest" },
        { chain: "solana", address: "SoLtest" },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty addresses array", () => {
    const result = addressStoreSchema.safeParse({
      ownership_id: VALID_UUID,
      ownership_version: "v1",
      addresses: [],
    })
    expect(result.success).toBe(false)
  })

  it("rejects unknown chain", () => {
    const result = addressStoreSchema.safeParse({
      ownership_id: VALID_UUID,
      ownership_version: "v1",
      addresses: [{ chain: "dogecoin", address: "Dtest" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing ownership_version", () => {
    const result = addressStoreSchema.safeParse({
      ownership_id: VALID_UUID,
      addresses: [{ chain: "bitcoin", address: "bc1qtest" }],
    })
    expect(result.success).toBe(false)
  })
})

describe("bioUpdateSchema", () => {
  it("accepts valid bio under 160 chars", () => {
    const result = bioUpdateSchema.safeParse({ ownership_id: VALID_UUID, bio: "Hello world" })
    expect(result.success).toBe(true)
  })

  it("rejects bio over 160 chars", () => {
    const result = bioUpdateSchema.safeParse({ ownership_id: VALID_UUID, bio: "a".repeat(161) })
    expect(result.success).toBe(false)
  })

  it("trims whitespace from bio", () => {
    const result = bioUpdateSchema.safeParse({ ownership_id: VALID_UUID, bio: "  hello  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.bio).toBe("hello")
    }
  })
})

describe("siteAuthSchema", () => {
  it("accepts valid password", () => {
    expect(siteAuthSchema.safeParse({ password: "secret123" }).success).toBe(true)
  })

  it("rejects password over 256 chars", () => {
    expect(siteAuthSchema.safeParse({ password: "a".repeat(257) }).success).toBe(false)
  })
})

describe("handleLookupSchema", () => {
  it("lowercases and trims input", () => {
    const result = handleLookupSchema.safeParse({ handle: "  CoolWater  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.handle).toBe("coolwater")
    }
  })

  it("rejects empty handle", () => {
    expect(handleLookupSchema.safeParse({ handle: "" }).success).toBe(false)
  })
})
