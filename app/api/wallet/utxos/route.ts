import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { addressQuerySchema, validate } from "@/lib/validation"

// GET /api/wallet/utxos?address=<btc_address>
// Returns UTXOs for a Bitcoin address via Blockstream (with Blockcypher fallback).

interface UTXO {
  txid: string
  vout: number
  value: number
  status: { confirmed: boolean }
}

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const parsed = validate(addressQuerySchema, { address: searchParams.get("address") ?? "" })
  if (parsed.error) return parsed.error
  const { address } = parsed.data

  // Try Blockstream
  try {
    const res = await fetch(`https://blockstream.info/api/address/${address}/utxo`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    })
    if (res.ok) {
      const utxos: UTXO[] = await res.json()
      return NextResponse.json({ utxos })
    }
  } catch {
    /* fall through */
  }

  // Fallback: Blockcypher
  try {
    const res = await fetch(
      `https://api.blockcypher.com/v1/btc/main/addrs/${address}?unspentOnly=true&includeScript=false`,
      { headers: { Accept: "application/json" }, next: { revalidate: 30 } },
    )
    if (res.ok) {
      const data = await res.json()
      const utxos: UTXO[] = (data.txrefs ?? []).map((ref: { tx_hash: string; tx_output_n: number; value: number; confirmations: number }) => ({
        txid: ref.tx_hash,
        vout: ref.tx_output_n,
        value: ref.value,
        status: { confirmed: ref.confirmations > 0 },
      }))
      return NextResponse.json({ utxos })
    }
  } catch {
    /* fall through */
  }

  return NextResponse.json({ error: "Failed to fetch UTXOs" }, { status: 502 })
}
