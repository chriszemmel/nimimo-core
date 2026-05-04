import { USDC_DECIMALS, USDC_MINT_SOLANA } from "@/lib/adapters/solana-usdc"

describe("Solana USDC constants", () => {
  it("pins the mainnet USDC mint to Circle's canonical address", () => {
    // If this changes, every user's existing token accounts are invalidated.
    // Only bump this after coordinating with Circle / reading their docs.
    expect(USDC_MINT_SOLANA).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
  })

  it("uses 6 decimals", () => {
    // USDC uses 6 decimals on both Solana and Ethereum.
    expect(USDC_DECIMALS).toBe(6)
  })
})
