import { ADJECTIVES, NOUNS, generateHandle } from "@/lib/identity/wordlists"

const HANDLE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

describe("generateHandle", () => {
  it("returns a valid handle format", () => {
    const handle = generateHandle()
    expect(handle).toMatch(HANDLE_REGEX)
  })

  it("returns adjective-noun format with exactly one hyphen", () => {
    const handle = generateHandle()
    const parts = handle.split("-")
    expect(parts).toHaveLength(2)
  })

  it("uses an adjective from the ADJECTIVES array", () => {
    const handle = generateHandle()
    const adjective = handle.split("-")[0]
    expect(ADJECTIVES).toContain(adjective)
  })

  it("uses a noun from the NOUNS array", () => {
    const handle = generateHandle()
    const noun = handle.split("-")[1]
    expect(NOUNS).toContain(noun)
  })

  it("generates valid handles consistently across 50 runs", () => {
    for (let i = 0; i < 50; i++) {
      const handle = generateHandle()
      expect(handle).toMatch(HANDLE_REGEX)
      const [adj, noun] = handle.split("-")
      expect(ADJECTIVES).toContain(adj)
      expect(NOUNS).toContain(noun)
    }
  })
})

describe("ADJECTIVES wordlist", () => {
  it("contains no duplicates", () => {
    const unique = new Set(ADJECTIVES)
    expect(unique.size).toBe(ADJECTIVES.length)
  })

  it("all entries are lowercase alphanumeric", () => {
    for (const word of ADJECTIVES) {
      expect(word).toMatch(/^[a-z][a-z0-9]*$/)
    }
  })
})

describe("NOUNS wordlist", () => {
  it("contains no duplicates", () => {
    const unique = new Set(NOUNS)
    expect(unique.size).toBe(NOUNS.length)
  })

  it("all entries are lowercase alphanumeric", () => {
    for (const word of NOUNS) {
      expect(word).toMatch(/^[a-z][a-z0-9]*$/)
    }
  })
})
