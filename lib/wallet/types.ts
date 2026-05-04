export interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  timestamp: number
  status: "success" | "failed" | "pending"
  blockNumber?: number
  direction?: "incoming" | "outgoing"
}

export interface Balance {
  chain: string
  /**
   * Token identifier within the chain. Undefined for the chain's native
   * asset (BTC on bitcoin, ETH on ethereum, SOL on solana). Set to "USDC"
   * etc. for SPL / ERC-20 tokens. Consumers that want the native balance
   * for a chain should filter on `!b.token`.
   */
  token?: string
  symbol: string
  name: string
  address: string
  balance: string
  balanceUSD?: string
  balanceFiat?: string
  balanceFiatEUR?: number
  balanceFiatUSD?: number
  priceEUR?: number
  priceUSD?: number
  logo: string
  transactions?: Transaction[]
  /**
   * Optional sibling balances surfaced behind the same row (e.g. Enjin Relay
   * + Matrix parachain). The wallet renders the parent as a single asset
   * row; tapping it expands to show each sub-balance individually.
   */
  subBalances?: Balance[]
}

export interface WalletData {
  balances: Balance[]
  totalUSD?: string
  totalFiat?: string
}
