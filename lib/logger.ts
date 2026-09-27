/**
 * Structured logger with context for consistent error reporting.
 *
 * Usage:
 *   const log = logger("wallet")
 *   log.error("Failed to fetch balances", error)
 *   log.error("Failed to fetch balances", error, { ownershipId, chain })
 *   log.warn("Price cache stale", { age: 300 })
 */

type LogContext = Record<string, unknown>

interface Logger {
  error: (message: string, error?: unknown, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
}

// Substring match, so `key` already covers apiKey/privateKey and `seed`
// covers seedPhrase. The additions are stems those two miss.
const SENSITIVE_KEYS = [
  "password",
  "passphrase",
  "phrase",
  "secret",
  "token",
  "mnemonic",
  "seed",
  "entropy",
  "key",
  "credential",
  "authorization",
  "cookie",
  "jwt",
  "otp",
]

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

// Drop any key matching the sensitive denylist at ANY depth - a secret nested
// under a non-sensitive key (e.g. { user: { token } }) must not slip through.
// Recurses into plain objects and arrays only (Date, Error, etc. pass through
// untouched); a depth cap guards against pathological / cyclic input.
function redact(value: unknown, depth: number): unknown {
  if (depth > 6) return "[truncated]"
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  if (isPlainObject(value)) {
    const safe: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) continue
      safe[k] = redact(v, depth + 1)
    }
    return safe
  }
  return value
}

function stripSensitive(context: LogContext): LogContext {
  return redact(context, 0) as LogContext
}

// Secret-shaped fragments that show up inside *error messages*, which
// never pass through `redact` - that only walks the structured context.
// A Postgres driver error can carry the whole connection string, and an
// SDK error can echo the request it failed on, so the message itself
// needs scrubbing before it reaches a log sink.
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // postgres://user:password@host → keep the shape, drop the credentials
  [/\/\/[^/\s:@]+:[^/\s@]+@/g, "//[redacted]@"],
  // ?api_key=… / &token=… / "secret": "…"
  [/([?&](?:api[-_]?key|key|token|secret|password|auth)=)[^&\s"']+/gi, "$1[redacted]"],
  [/(["']?(?:api[-_]?key|token|secret|password|passphrase|mnemonic)["']?\s*[:=]\s*["']?)[^,\s"'}]+/gi, "$1[redacted]"],
  // Bearer <token>
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [redacted]"],
]

function scrubSecrets(message: string): string {
  let out = message
  for (const [re, replacement] of SECRET_PATTERNS) out = out.replace(re, replacement)
  return out
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    const code = "code" in error ? ` [${(error as { code: string }).code}]` : ""
    return scrubSecrets(`${error.message}${code}`)
  }
  if (typeof error === "string") return scrubSecrets(error)
  return "Unknown error"
}

/**
 * Create a scoped logger for a module.
 * Prefixes all messages with [module] for grep-ability.
 * Never logs full error objects or sensitive context keys.
 */
export function logger(module: string): Logger {
  const prefix = `[${module}]`

  return {
    error(message: string, error?: unknown, context?: LogContext) {
      if (context) {
        console.error(prefix, message, safeError(error), stripSensitive(context))
      } else if (error !== undefined) {
        console.error(prefix, message, safeError(error))
      } else {
        console.error(prefix, message)
      }
    },

    warn(message: string, context?: LogContext) {
      if (context) {
        console.warn(prefix, message, stripSensitive(context))
      } else {
        console.warn(prefix, message)
      }
    },

    info(message: string, context?: LogContext) {
      if (context) {
        // eslint allows only warn/error - info maps to warn
        console.warn(prefix, message, stripSensitive(context))
      } else {
        console.warn(prefix, message)
      }
    },
  }
}
