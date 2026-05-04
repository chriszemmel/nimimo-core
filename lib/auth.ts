import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { NeonAdapter } from "./db-adapter"
import { createMagicLinkEmail } from "./email-template"
import { logger } from "./logger"

const log = logger("auth")

export const authOptions: NextAuthOptions = {
  adapter: NeonAdapter,
  providers: [
    EmailProvider({
      server: {
        host: "smtp.resend.com",
        port: 587,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY,
        },
      },
      from: process.env.EMAIL_FROM || "nimimo <auth@nimimo.com>",
      sendVerificationRequest: async ({ identifier: email, url, provider }) => {
        const { host } = new URL(url)

        const { subject, html, text } = createMagicLinkEmail({
          url, // Use the URL directly as NextAuth provides it
          host,
          email,
        })

        const nodemailer = await import("nodemailer")
        const transport = nodemailer.createTransport(provider.server)

        await transport.sendMail({
          to: email,
          from: provider.from,
          subject,
          text,
          html,
        })
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
    error: "/auth/verify",
    verifyRequest: "/auth/verify",
  },
  session: {
    strategy: "database" as const,
  },
  callbacks: {
    // #region session-callback
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id
      }
      return session
    },
    // #endregion session-callback
    async redirect({ url, baseUrl }) {
      // Use proper origin comparison to prevent open redirect attacks
      // e.g. "https://nimimo.com.evil.com" must NOT pass
      const baseOrigin = new URL(baseUrl).origin

      try {
        const urlObj = new URL(url, baseUrl)
        const callbackUrl = urlObj.searchParams.get("callbackUrl")

        if (callbackUrl) {
          // Relative paths are safe
          if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
            return baseUrl + callbackUrl
          }
          // Absolute URLs: verify same origin (not just prefix)
          try {
            const cbOrigin = new URL(callbackUrl).origin
            if (cbOrigin === baseOrigin) return callbackUrl
          } catch {
            // Invalid URL - fall through to defaults
          }
        }

        // For email verification, always go to verify page
        if (url.includes("/api/auth/callback/email")) {
          return baseUrl + "/auth/verify"
        }

        // Default: relative or same-origin only
        if (url.startsWith("/") && !url.startsWith("//")) return baseUrl + url
        try {
          if (new URL(url).origin === baseOrigin) return url
        } catch {
          // Invalid URL
        }
      } catch {
        // URL parsing failed
      }

      return baseUrl + "/identity"
    },
    async signIn({ user, account, profile: _profile }) {
      // If it's an OAuth provider and user has an email
      if (account?.type === "oauth" && user?.email) {
        try {
          // Check if user already exists with this email
          const existingUser = await NeonAdapter.getUserByEmail!(user.email)

          if (existingUser) {
            // Check if this OAuth account is already linked
            const linkedUser = await NeonAdapter.getUserByAccount!({
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            })

            if (!linkedUser) {
              // Link the OAuth account to the existing user
              // Double-cast needed: next-auth and @auth/core define incompatible AdapterAccount types
              const linkFn = NeonAdapter.linkAccount as unknown as (account: Record<string, unknown>) => Promise<void>
              await linkFn({
                ...account,
                userId: existingUser.id,
              })
            }
          }
        } catch (error) {
          // Account linking failed (e.g. DB timeout) - allow sign-in anyway.
          // The link will be retried on the next OAuth sign-in.
          log.error("OAuth account linking failed (non-blocking)", error)
        }
      }

      return true
    },
  },
  // Suppress NextAuth's client-side _log endpoint to prevent request spam.
  // When session fetches fail (e.g. 429), NextAuth logs errors which generate
  // MORE requests to /api/auth/_log, creating a cascade.
  logger: {
    error: (code, metadata) => {
      log.error("NextAuth error", { code, metadata })
    },
    warn: (code) => {
      log.warn("NextAuth warning", { code })
    },
    debug: (code, metadata) => {
      if (process.env.NODE_ENV === "development") {
        log.info("NextAuth debug", { code, metadata })
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
}
