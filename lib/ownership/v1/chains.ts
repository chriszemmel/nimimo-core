// Ownership V1 supported chains - Single source of truth.
//
// The base set (Bitcoin, Ethereum, Solana) is derived for every ownership.

export interface ChainConfig {
  chain: string
  symbol: string
  name: string
  derivationPath: string
  addressType: string
  logo: string
}

export const MANDATORY_V1_CHAINS: ChainConfig[] = [
  {
    chain: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    derivationPath: "m/84'/0'/0'/0/0",
    addressType: "p2wpkh",
    logo: "/logos/bitcoin.svg",
  },
  {
    chain: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    derivationPath: "m/44'/60'/0'/0/0",
    addressType: "eoa",
    logo: "/logos/ethereum.svg",
  },
  {
    chain: "solana",
    symbol: "SOL",
    name: "Solana",
    derivationPath: "m/44'/501'/0'",
    addressType: "ed25519",
    logo: "/logos/solana.svg",
  },
]

export const OWNERSHIP_V1_CHAINS: ChainConfig[] = [...MANDATORY_V1_CHAINS]

export function getChainConfig(chain: string): ChainConfig | undefined {
  return OWNERSHIP_V1_CHAINS.find((c) => c.chain === chain)
}
