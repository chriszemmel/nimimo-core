/** Base error class for all nimimo SDK errors */
export class NimimoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "NimimoError"
  }
}

/** Handle does not exist */
export class HandleNotFound extends NimimoError {
  constructor(handle: string) {
    super(`Handle "${handle}" not found`, "not_found", 404)
    this.name = "HandleNotFound"
  }
}

/** No address registered for the requested chain */
export class NoAddress extends NimimoError {
  constructor(handle: string, chain: string) {
    super(
      `No ${chain} address registered for "${handle}"`,
      "no_address",
      404,
    )
    this.name = "NoAddress"
  }
}

/** Invalid handle format */
export class InvalidHandle extends NimimoError {
  constructor(handle: string) {
    super(`Invalid handle format: "${handle}"`, "invalid_handle", 400)
    this.name = "InvalidHandle"
  }
}

/** Invalid chain */
export class InvalidChain extends NimimoError {
  constructor(chain: string) {
    super(
      `Unsupported chain: "${chain}". Use bitcoin, ethereum, or solana`,
      "invalid_chain",
      400,
    )
    this.name = "InvalidChain"
  }
}

/** Intent not found */
export class IntentNotFound extends NimimoError {
  constructor(id: string) {
    super(`Intent "${id}" not found`, "not_found", 404)
    this.name = "IntentNotFound"
  }
}

/** Intent has expired */
export class IntentExpired extends NimimoError {
  constructor(id: string) {
    super(`Intent "${id}" has expired`, "intent_expired", 410)
    this.name = "IntentExpired"
  }
}

/** Invalid intent state transition */
export class InvalidTransition extends NimimoError {
  constructor(from: string, to: string) {
    super(
      `Cannot transition from "${from}" to "${to}"`,
      "invalid_transition",
      409,
    )
    this.name = "InvalidTransition"
  }
}

/** Rate limited */
export class RateLimited extends NimimoError {
  public readonly retryAfter: number | null

  constructor(retryAfter: number | null = null) {
    super("Rate limited - too many requests", "rate_limited", 429)
    this.name = "RateLimited"
    this.retryAfter = retryAfter
  }
}
