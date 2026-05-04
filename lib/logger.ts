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

const SENSITIVE_KEYS = ["password", "secret", "token", "mnemonic", "seed", "key", "authorization", "cookie"]

function stripSensitive(context: LogContext): LogContext {
  const safe: LogContext = {}
  for (const [k, v] of Object.entries(context)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) continue
    safe[k] = v
  }
  return safe
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    const code = "code" in error ? ` [${(error as { code: string }).code}]` : ""
    return `${error.message}${code}`
  }
  if (typeof error === "string") return error
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
