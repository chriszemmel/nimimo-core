import rpcConfig from "@/rpc-config.json"
import type { Transaction } from "@/lib/wallet/types"
import { logger } from "@/lib/logger"
import { fetchWithTimeout } from "./fetch-timeout"
import { resolveRPCEndpoint } from "./rpc-helpers"

const log = logger("ethereum")

export async function getEthereumBalance(address: string): Promise<string> {
  const endpoints = rpcConfig.ethereum.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      const target = resolveRPCEndpoint(endpoint)
      if (!target) continue

      const response = await fetchWithTimeout(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      const balanceWei = BigInt(data.result)
      const balanceETH = (Number(balanceWei) / 1e18).toFixed(6)

      return balanceETH
    } catch (error) {
      log.error(`${endpoint.name} balance failed`, error)
      continue
    }
  }

  return "0.000000"
}

export async function getEthereumTransactions(address: string): Promise<Transaction[]> {
  const alchemyKey = process.env.ALCHEMY_API_KEY
  if (alchemyKey) {
    try {
      const rpcUrl = "https://eth-mainnet.g.alchemy.com/v2"
      const rpcHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${alchemyKey}` }
      const body = (direction: "in" | "out") => JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          ...(direction === "in" ? { toAddress: address } : { fromAddress: address }),
          category: ["external"],
          maxCount: "0xa",
          order: "desc",
          withMetadata: true,
        }],
        id: 1,
      })

      const [inRes, outRes] = await Promise.all([
        fetch(rpcUrl, { method: "POST", headers: rpcHeaders, body: body("in") }),
        fetch(rpcUrl, { method: "POST", headers: rpcHeaders, body: body("out") }),
      ])

      const [inData, outData] = await Promise.all([inRes.json(), outRes.json()])

      interface AlchemyTransfer {
        hash: string; from: string; to: string; value: number | null;
        blockNum: string; metadata?: { blockTimestamp?: string };
      }
      const inTransfers: AlchemyTransfer[] = inData.result?.transfers ?? []
      const outTransfers: AlchemyTransfer[] = outData.result?.transfers ?? []

      const seen = new Set<string>()
      const all = [...inTransfers, ...outTransfers].filter((tx) => {
        if (seen.has(tx.hash)) return false
        seen.add(tx.hash)
        return true
      })

      all.sort((a, b) => (Number(b.blockNum) - Number(a.blockNum)))

      const transactions: Transaction[] = all.slice(0, 10).map((tx) => {
        const valueStr = tx.value != null
          ? Number(tx.value).toFixed(6).replace(/\.?0+$/, "") || "0"
          : "0"
        const direction: "incoming" | "outgoing" =
          (tx.to ?? "").toLowerCase() === address.toLowerCase() ? "incoming" : "outgoing"
        const ts = tx.metadata?.blockTimestamp
          ? new Date(tx.metadata.blockTimestamp).getTime()
          : Date.now()

        return {
          hash: tx.hash,
          from: tx.from ?? "",
          to: tx.to ?? "",
          value: valueStr,
          timestamp: ts,
          status: "success",
          blockNumber: Number(tx.blockNum),
          direction,
        } satisfies Transaction
      })

      return transactions
    } catch (error) {
      log.error("Alchemy ETH transactions failed", error)
    }
  }

  // Fallback: Etherscan with optional API key
  try {
    const etherscanKey = process.env.ETHERSCAN_API_KEY
    const keyParam = etherscanKey ? `&apikey=${etherscanKey}` : ""
    const url =
      `https://api.etherscan.io/api?module=account&action=txlist` +
      `&address=${encodeURIComponent(address)}&startblock=0&endblock=latest` +
      `&page=1&offset=10&sort=desc${keyParam}`

    const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    if (data.status !== "1" || !Array.isArray(data.result)) {
      return []
    }

    interface EtherscanTx {
      hash: string; from: string; to: string; value: string;
      timeStamp: string; isError: string; blockNumber: string;
    }
    const transactions: Transaction[] = data.result.map((tx: EtherscanTx) => {
      const valueETH = BigInt(tx.value) / 10n ** 15n
      const valueStr = (Number(valueETH) / 1000).toFixed(6).replace(/\.?0+$/, "") || "0"
      const direction: "incoming" | "outgoing" =
        tx.to.toLowerCase() === address.toLowerCase() ? "incoming" : "outgoing"

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: valueStr,
        timestamp: Number(tx.timeStamp) * 1000,
        status: tx.isError === "0" ? "success" : "failed",
        blockNumber: Number(tx.blockNumber),
        direction,
      } satisfies Transaction
    })

    return transactions
  } catch (error) {
    log.error("Etherscan transactions failed", error)
    return []
  }
}
