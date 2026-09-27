import { describe, it, expect } from "vitest"
import { createMagicLinkEmail } from "@/lib/email-template"

/**
 * Real nodemailer, not a mock.
 *
 * `email-verification.test.ts` mocks the transport so it can assert what our
 * code asks nodemailer to do. That proves our side and nothing about
 * nodemailer's, which is exactly the gap that kept the 8.x pin in place. This
 * file closes it: the actual installed nodemailer builds the actual message
 * from the actual template output, through `jsonTransport`, which runs the
 * full compose path and stops short only of opening a socket.
 *
 * If a major bump changes how addresses are parsed, how headers are built, or
 * how a multipart body is assembled, it fails here.
 */

const CALLBACK =
  "https://nimimo.com/api/auth/callback/email?token=t0ken&email=user%40example.com"

async function sendThroughRealNodemailer(to: string, from: string) {
  const nodemailer = await import("nodemailer")
  const transport = nodemailer.createTransport({ jsonTransport: true })

  const { subject, html, text } = createMagicLinkEmail({
    url: CALLBACK,
    host: "nimimo.com",
    email: to,
  })

  const info = await transport.sendMail({ to, from, subject, text, html })
  return JSON.parse((info as { message: string }).message)
}

describe("nodemailer integration", () => {
  it("is on a version without the two known advisories", async () => {
    const { version } = await import("nodemailer/package.json")
    const major = Number(String(version).split(".")[0])
    // 9.x fixes the raw-message `disableFileAccess` bypass and the quadratic
    // address parser. Dropping back below it reopens both.
    expect(major).toBeGreaterThanOrEqual(9)
  })

  it("composes the magic link message end to end", async () => {
    const message = await sendThroughRealNodemailer(
      "user@example.com",
      "nimimo <auth@nimimo.com>",
    )

    expect(message.to).toEqual([{ address: "user@example.com", name: "" }])
    expect(message.from).toEqual({ address: "auth@nimimo.com", name: "nimimo" })
    expect(message.subject).toContain("nimimo")

    // Both alternatives survive compose, and the link is intact in each.
    expect(message.text).toContain(CALLBACK)
    expect(message.html).toContain("token=t0ken&amp;email=")
    expect(message.messageId).toMatch(/^<.+>$/)
  })

  it("parses a display-name sender without mangling the address", async () => {
    // The quadratic address-parsing advisory was in this code path, so the
    // parser changed. A sender that silently becomes malformed would fail
    // delivery in production and nowhere else.
    const message = await sendThroughRealNodemailer(
      "someone+tagged@sub.example.com",
      "nimimo Support <support@nimimo.com>",
    )

    expect(message.from).toEqual({ address: "support@nimimo.com", name: "nimimo Support" })
    expect(message.to).toEqual([{ address: "someone+tagged@sub.example.com", name: "" }])
  })

  it("does not validate the recipient, which is why upstream must", async () => {
    // Pinning real behaviour that is easy to assume the other way round.
    // nodemailer does not reject a malformed recipient. It parses
    // "not-an-email" into an empty address with the string as a display
    // name, and composing succeeds, so nothing here would surface the
    // problem before an SMTP server refused the envelope.
    const message = await sendThroughRealNodemailer(
      "not-an-email",
      "nimimo <auth@nimimo.com>",
    )
    expect(message.to).toEqual([{ address: "", name: "not-an-email" }])

    // So the validation has to happen before this point, and it does: the
    // identifier is validated by next-auth before `sendVerificationRequest`
    // is ever called.
  })
})
