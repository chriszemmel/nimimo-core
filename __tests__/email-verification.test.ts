import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * The transactional email path.
 *
 * This is the only mail nimimo sends. nodemailer 9 changes behaviour on
 * exactly this path, so these tests are what make the bump from 8.x safe
 * to take rather than probably safe.
 *
 * One trap is worth naming, because a test that falls into it passes while
 * proving nothing. next-auth v4's `EmailProvider()` returns an object with
 * its OWN defaults on top (`localhost:25`, a `NextAuth <no-reply@...>`
 * sender, and a default `sendVerificationRequest`), and stashes the caller's
 * options under `.options`, merging them only later in `parseProviders`.
 * Reading `provider.sendVerificationRequest` therefore hands you next-auth's
 * implementation, not ours. Everything below goes through `.options`.
 */

const sendMail = vi.fn()
const createTransport = vi.fn(() => ({ sendMail }))

vi.mock("nodemailer", () => ({
  default: { createTransport },
  createTransport,
}))

type EmailOptions = {
  server: unknown
  from: string
  sendVerificationRequest: (params: {
    identifier: string
    url: string
    provider: { server: unknown; from: string }
  }) => Promise<void>
}

async function emailOptions(): Promise<EmailOptions> {
  const { authOptions } = await import("@/lib/auth")
  const provider = (authOptions.providers as unknown as { id: string; options: EmailOptions }[]).find(
    (p) => p.id === "email",
  )
  if (!provider?.options?.sendVerificationRequest) {
    throw new Error("email provider options missing; next-auth provider shape changed")
  }
  return provider.options
}

const URL_UNDER_TEST = "https://nimimo.com/api/auth/callback/email?token=abc123&email=a%40b.com"

async function send(email = "user@example.com", url = URL_UNDER_TEST) {
  const options = await emailOptions()
  await options.sendVerificationRequest({
    identifier: email,
    url,
    provider: { server: options.server, from: options.from },
  })
  return options
}

beforeEach(() => {
  sendMail.mockReset()
  sendMail.mockResolvedValue({ messageId: "test" })
  createTransport.mockClear()
})

describe("magic link email", () => {
  it("builds the transport from the configured server", async () => {
    const options = await send()

    expect(createTransport).toHaveBeenCalledTimes(1)
    expect(createTransport).toHaveBeenCalledWith(options.server)

    // The configured relay, not next-auth's localhost:25 default. If this
    // ever reads localhost the provider merge has changed and mail silently
    // goes nowhere in production.
    expect(options.server).toMatchObject({ host: "smtp.resend.com", port: 587 })
  })

  it("sends to the address that asked, from the configured sender", async () => {
    const options = await send("someone@example.com")

    expect(sendMail).toHaveBeenCalledTimes(1)
    const message = sendMail.mock.calls[0][0] as Record<string, string>
    expect(message.to).toBe("someone@example.com")
    expect(message.from).toBe(options.from)
    expect(options.from).toContain("nimimo")
  })

  it("carries a working callback link in both bodies", async () => {
    await send("user@example.com", URL_UNDER_TEST)

    const message = sendMail.mock.calls[0][0] as Record<string, string>

    // A mangled link is the worst failure here, because the mail still
    // arrives and still looks right. The plain-text part carries the URL
    // verbatim, with one internal `callbackUrl` appended by the template so
    // the user lands on the verify page after signing in.
    expect(message.text).toContain(URL_UNDER_TEST)
    expect(message.text).toContain("callbackUrl=")

    // The HTML part is the same link with its ampersands entity-escaped,
    // which is correct HTML and is why this cannot assert the raw string.
    // Asserting the escaped form pins it: an unescaped `&` in an href is a
    // real bug, and so is a double-escaped `&amp;amp;`.
    expect(message.html).toContain("token=abc123&amp;email=")
    expect(message.html).not.toContain("&amp;amp;")

    expect(message.subject).toBeTruthy()
  })

  it("keeps the appended callbackUrl on our own origin", async () => {
    // The template appends a `callbackUrl`, and next-auth redirects there
    // after a successful sign-in. An off-origin value would turn the magic
    // link into an open redirect carrying a freshly authenticated session.
    await send()
    const message = sendMail.mock.calls[0][0] as Record<string, string>

    const match = message.text.match(/callbackUrl=([^\s&]+)/)
    expect(match, "no callbackUrl found in the text body").toBeTruthy()
    const callback = decodeURIComponent(match![1])
    expect(callback.startsWith("https://nimimo.com/")).toBe(true)
  })

  it("never puts the raw token anywhere but the link", async () => {
    await send()
    const message = sendMail.mock.calls[0][0] as Record<string, string>
    // The subject line lands in notifications and previews.
    expect(message.subject).not.toContain("abc123")
  })

  it("propagates a transport failure instead of reporting success", async () => {
    sendMail.mockRejectedValue(new Error("smtp refused"))
    await expect(send()).rejects.toThrow("smtp refused")
  })
})
