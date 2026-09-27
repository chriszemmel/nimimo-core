import { formatRelativeTime, blockTimeToMs } from "@/lib/wallet/utils"
import { backgroundForHandle, generateCroodlesSVG } from "@/lib/croodles/generator"

// Every assertion in this file pins a locale explicitly so the
// test output is stable across CI environments. `Intl.*` APIs
// read the host default locale otherwise, which is not what we
// want to test against.
describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-25T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const now = new Date("2026-03-25T12:00:00Z").getTime()

  // ── English output ─────────────────────────────────────────────
  it("returns 'now' for ≤10 seconds ago (en)", () => {
    expect(formatRelativeTime(now - 5_000, "en")).toBe("now")
    expect(formatRelativeTime(now - 10_000, "en")).toBe("now")
  })

  it("returns '30 seconds ago' for 30 seconds (en)", () => {
    expect(formatRelativeTime(now - 30_000, "en")).toBe("30 seconds ago")
  })

  it("returns '1 minute ago' for 60 seconds (en)", () => {
    expect(formatRelativeTime(now - 60_000, "en")).toBe("1 minute ago")
  })

  it("returns '59 minutes ago' for 59 minutes (en)", () => {
    expect(formatRelativeTime(now - 59 * 60_000, "en")).toBe("59 minutes ago")
  })

  it("returns '1 hour ago' for 1 hour (en)", () => {
    expect(formatRelativeTime(now - 3_600_000, "en")).toBe("1 hour ago")
  })

  it("returns '23 hours ago' for 23 hours (en)", () => {
    expect(formatRelativeTime(now - 23 * 3_600_000, "en")).toBe("23 hours ago")
  })

  it("returns 'yesterday' for 24-47 hours (en)", () => {
    expect(formatRelativeTime(now - 30 * 3_600_000, "en")).toBe("yesterday")
    expect(formatRelativeTime(now - 47 * 3_600_000, "en")).toBe("yesterday")
  })

  it("returns a numeric date for 48+ hours ago (en)", () => {
    const threeDaysAgo = now - 72 * 3_600_000
    const result = formatRelativeTime(threeDaysAgo, "en")
    // en-US: MM/DD/YYYY. Matches either MM/DD/YYYY or DD/MM/YYYY
    // depending on the host's en flavor - both are acceptable, we
    // only care that it's a numeric date, not the order.
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  // ── German output (the reason locale-awareness exists) ────────
  it("returns 'jetzt' for ≤10 seconds ago (de)", () => {
    expect(formatRelativeTime(now - 5_000, "de")).toBe("jetzt")
  })

  it("returns German relative phrases for minutes/hours (de)", () => {
    expect(formatRelativeTime(now - 60_000, "de")).toBe("vor 1 Minute")
    expect(formatRelativeTime(now - 2 * 3_600_000, "de")).toBe("vor 2 Stunden")
  })

  it("returns 'gestern' for 24-47 hours (de)", () => {
    expect(formatRelativeTime(now - 30 * 3_600_000, "de")).toBe("gestern")
  })

  it("returns a numeric date for 48+ hours ago (de)", () => {
    const threeDaysAgo = now - 72 * 3_600_000
    const result = formatRelativeTime(threeDaysAgo, "de")
    // de: DD.MM.YYYY
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
  })

  // ── Non-finite guard ──────────────────────────────────────────
  // A NaN/Infinity timestamp (an unconfirmed tx with no block time, or a
  // malformed value from a flaky RPC) must NOT throw - Intl.RelativeTimeFormat
  // and Intl.DateTimeFormat both raise RangeError on non-finite input, and
  // that throw used to bubble to the route error boundary and blank the
  // whole wallet. The function now treats an unknown time as "now".
  it("does not throw on NaN / Infinity and falls back to 'now'", () => {
    expect(() => formatRelativeTime(NaN, "en")).not.toThrow()
    expect(() => formatRelativeTime(Infinity, "en")).not.toThrow()
    expect(() => formatRelativeTime(-Infinity, "en")).not.toThrow()
    expect(formatRelativeTime(NaN, "en")).toBe("now")
    expect(formatRelativeTime(NaN, "de")).toBe("jetzt")
  })
})

describe("blockTimeToMs", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-25T12:00:00Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("converts a valid block time (seconds) to epoch ms", () => {
    expect(blockTimeToMs(1_700_000_000)).toBe(1_700_000_000_000)
  })

  it("falls back to now for null / undefined (just-confirmed tx)", () => {
    const now = Date.now()
    expect(blockTimeToMs(null)).toBe(now)
    expect(blockTimeToMs(undefined)).toBe(now)
  })

  it("falls back to now for malformed / non-finite values", () => {
    const now = Date.now()
    expect(blockTimeToMs("not-a-number")).toBe(now)
    expect(blockTimeToMs(NaN)).toBe(now)
    expect(blockTimeToMs(0)).toBe(now)
    expect(blockTimeToMs({})).toBe(now)
  })

  it("never produces a NaN timestamp that would crash formatRelativeTime", () => {
    for (const v of [null, undefined, NaN, "x", {}, [], -5]) {
      expect(Number.isFinite(blockTimeToMs(v))).toBe(true)
    }
  })
})

describe("backgroundForHandle", () => {
  it("returns an object with name and color", () => {
    const bg = backgroundForHandle("test")
    expect(bg).toHaveProperty("name")
    expect(bg).toHaveProperty("color")
    expect(typeof bg.name).toBe("string")
    expect(typeof bg.color).toBe("string")
  })

  it("is deterministic - same handle returns same result", () => {
    const bg1 = backgroundForHandle("cool-water")
    const bg2 = backgroundForHandle("cool-water")
    expect(bg1).toEqual(bg2)
  })

  it("returns first background (azure) for empty handle", () => {
    const bg = backgroundForHandle("")
    expect(bg.name).toBe("azure")
    expect(bg.color).toBe("e0f2fe")
  })
})

describe("generateCroodlesSVG", () => {
  it("returns URL starting with /api/avatar?seed=", () => {
    const url = generateCroodlesSVG("cool-water")
    expect(url).toMatch(/^\/api\/avatar\?seed=/)
  })

  it("contains bg= parameter", () => {
    const url = generateCroodlesSVG("cool-water")
    expect(url).toContain("&bg=")
  })

  it("uses 'anonymous' as seed for empty handle", () => {
    const url = generateCroodlesSVG("")
    expect(url).toContain("seed=anonymous")
  })
})
