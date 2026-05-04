import {
  findAssociatedTokenAccountBase58,
  tokenAmountToRawUnits,
  USDC_DECIMALS as SEND_USDC_DECIMALS,
  USDC_MINT_ADDRESS as SEND_USDC_MINT,
} from "@/lib/wallet/solana-send"
import { USDC_DECIMALS as ADAPTER_USDC_DECIMALS, USDC_MINT_SOLANA } from "@/lib/adapters/solana-usdc"

describe("SPL token constants", () => {
  it("uses the same USDC mint in the adapter and the send flow", () => {
    expect(SEND_USDC_MINT).toBe(USDC_MINT_SOLANA)
    expect(SEND_USDC_MINT).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
  })

  it("uses the same USDC decimals in the adapter and the send flow", () => {
    expect(SEND_USDC_DECIMALS).toBe(ADAPTER_USDC_DECIMALS)
    expect(SEND_USDC_DECIMALS).toBe(6)
  })
})

describe("findAssociatedTokenAccountBase58", () => {
  // Regression vectors computed with the hand-rolled `findProgramAddress`
  // implementation against Solana mainnet's canonical ATA scheme. If any of
  // these values change we've broken the derivation. Same symptom as sending
  // SPL tokens to the wrong account (silently lost funds), so this test is
  // deliberately strict.
  it("derives the USDC ATA for a known owner", () => {
    const ata = findAssociatedTokenAccountBase58(
      "DSnHRhw5KUpfcDHmrkhqmzTAGuZXnRJaYMQsa7SV4ZS4",
      SEND_USDC_MINT,
    )
    expect(ata).toBe("8KRKfBsSJmRnTskecSZafhW6yyfhdPkT1hvjPqsCTqEY")
  })

  it("derives a different ATA for a different owner under the same mint", () => {
    const a = findAssociatedTokenAccountBase58(
      "DSnHRhw5KUpfcDHmrkhqmzTAGuZXnRJaYMQsa7SV4ZS4",
      SEND_USDC_MINT,
    )
    const b = findAssociatedTokenAccountBase58(
      "So11111111111111111111111111111111111111112",
      SEND_USDC_MINT,
    )
    expect(a).not.toBe(b)
    expect(b).toBe("DHe62eeQVEnNK7vg5xUpDkJm7tuqHadjhvmPRFBG9UPo")
  })

  it("is deterministic", () => {
    const a = findAssociatedTokenAccountBase58(
      "DSnHRhw5KUpfcDHmrkhqmzTAGuZXnRJaYMQsa7SV4ZS4",
      SEND_USDC_MINT,
    )
    const b = findAssociatedTokenAccountBase58(
      "DSnHRhw5KUpfcDHmrkhqmzTAGuZXnRJaYMQsa7SV4ZS4",
      SEND_USDC_MINT,
    )
    expect(a).toBe(b)
  })
})

describe("tokenAmountToRawUnits", () => {
  it("scales a whole-dollar amount to USDC base units", () => {
    expect(tokenAmountToRawUnits("10", 6)).toBe(10_000_000n)
    expect(tokenAmountToRawUnits("10.00", 6)).toBe(10_000_000n)
  })

  it("handles fractional amounts at exact precision", () => {
    expect(tokenAmountToRawUnits("10.50", 6)).toBe(10_500_000n)
    expect(tokenAmountToRawUnits("0.000001", 6)).toBe(1n)
  })

  it("rejects amounts that exceed the decimal precision", () => {
    expect(() => tokenAmountToRawUnits("0.0000001", 6)).toThrow(/decimal places/)
  })

  it("rejects non-numeric input", () => {
    expect(() => tokenAmountToRawUnits("10.5abc", 6)).toThrow()
    expect(() => tokenAmountToRawUnits("", 6)).toThrow()
    expect(() => tokenAmountToRawUnits("1.2.3", 6)).toThrow()
  })

  it("pads shorter fractions to the full precision", () => {
    // "1.5" at 6 decimals = 1_500_000
    expect(tokenAmountToRawUnits("1.5", 6)).toBe(1_500_000n)
  })
})
