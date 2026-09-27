import { logger } from "@/lib/logger"

// logger.warn forwards the redacted context as the 3rd console.warn arg.
function lastContext(spy: ReturnType<typeof vi.spyOn>) {
  const calls = spy.mock.calls
  return calls[calls.length - 1][2]
}

describe("logger sensitive-key redaction", () => {
  it("strips sensitive keys at the top level (regression)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    logger("test").warn("msg", { mnemonic: "x", fine: 1 })
    expect(lastContext(spy)).toEqual({ fine: 1 })
    spy.mockRestore()
  })

  it("strips sensitive keys nested in objects and arrays", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    logger("test").warn("msg", {
      safe: 1,
      nested: { password: "p", token: "t", keep: 2 },
      arr: [{ secret: "s", ok: 3 }],
    })
    expect(lastContext(spy)).toEqual({ safe: 1, nested: { keep: 2 }, arr: [{ ok: 3 }] })
    spy.mockRestore()
  })

  it("leaves non-plain objects (e.g. Date) untouched", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const d = new Date("2026-01-01T00:00:00Z")
    logger("test").warn("msg", { when: d })
    expect(lastContext(spy)).toEqual({ when: d })
    spy.mockRestore()
  })

  it("covers the stems that plain `key`/`seed` miss", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    logger("test").warn("msg", {
      passphrase: "a",
      entropy: "b",
      credential: "c",
      jwt: "d",
      otp: "e",
      keep: 1,
    })
    expect(lastContext(spy)).toEqual({ keep: 1 })
    spy.mockRestore()
  })
})

// `redact` only walks the structured context. The error argument went
// straight to `error.message`, so a driver error carrying a connection
// string or a request URL was logged verbatim.
describe("logger error-message scrubbing", () => {
  function lastError(spy: ReturnType<typeof vi.spyOn>) {
    const calls = spy.mock.calls
    return calls[calls.length - 1][2]
  }

  it("strips credentials out of a connection string", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    logger("test").error(
      "db down",
      new Error("connect ECONNREFUSED postgresql://admin:hunter2@db.example.com/main"),
    )
    expect(lastError(spy)).not.toContain("hunter2")
    expect(lastError(spy)).toContain("[redacted]")
    spy.mockRestore()
  })

  it("strips an api key out of a request URL", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    logger("test").error("rpc failed", new Error("GET https://rpc.example/v2?api_key=abcd1234efgh 401"))
    expect(lastError(spy)).not.toContain("abcd1234efgh")
    spy.mockRestore()
  })

  it("strips a bearer token", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    logger("test").error("upstream", new Error("rejected Authorization: Bearer sk_live_9f8e7d6c5b4a"))
    expect(lastError(spy)).not.toContain("sk_live_9f8e7d6c5b4a")
    spy.mockRestore()
  })

  it("leaves an ordinary message alone", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    logger("test").error("boom", new Error("Transaction not found"))
    expect(lastError(spy)).toBe("Transaction not found")
    spy.mockRestore()
  })
})
