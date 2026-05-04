# @nimimo/resolve

Official TypeScript SDK for the [nimimo](https://nimimo.com) v1 API.

Resolve human-readable handles like `@neat-gecko` to Bitcoin, Ethereum, and
Solana addresses, and create payment intents that users sign in their own
wallet.

- Zero runtime dependencies
- ~5KB minified, dual ESM/CJS
- Full TypeScript types
- Works in Node 18+, modern browsers, edge runtimes

> Status: `0.1.0`. The v1 API surface is stable; the SDK API may still see
> small additions before `1.0`.

## Install

```bash
npm install @nimimo/resolve
# or
pnpm add @nimimo/resolve
```

## Resolve a handle

```ts
import { NimimoClient } from "@nimimo/resolve"

const nimimo = new NimimoClient()

const { addresses } = await nimimo.resolve("neat-gecko")
console.log(addresses.bitcoin)   // "bc1q..."
console.log(addresses.ethereum)  // "0x..."
console.log(addresses.solana)    // "..."

// Single chain
const { address } = await nimimo.resolve("neat-gecko", "bitcoin")
```

## Create a payment intent

Use intents when the signer is someone other than the caller (invoices,
agents, third-party checkout). The payer signs at `sign_url` in their own
wallet.

```ts
const intent = await nimimo.createIntent({
  to: "@neat-gecko",
  chain: "ethereum",
  amount: "0.05",
  memo: "Invoice #1042",
})

// Open intent.sign_url in the payer's browser, then poll:
const status = await nimimo.getIntent(intent.intent_id)
if (status.status === "completed") {
  console.log("Paid:", status.tx_hash)
}
```

## Client-side payment helper

If your app already owns the signing flow, `paymentIntent()` resolves the
recipient and converts the amount to the chain's smallest unit. It does
**not** create a server-side intent record.

```ts
const intent = await nimimo.paymentIntent("neat-gecko", {
  chain: "ethereum",
  amount: "0.05",
})
// intent.to    → "0x..."
// intent.value → "50000000000000000" (wei)

await signer.sendTransaction({ to: intent.to, value: intent.value })
```

## Errors

All errors extend `NimimoError`. The named subclasses are:

- `HandleNotFound`, `NoAddress`, `InvalidHandle`, `InvalidChain` - resolve
- `IntentNotFound`, `IntentExpired`, `InvalidTransition` - intents
- `RateLimited` - when the server returns `429`

```ts
import { HandleNotFound, IntentExpired } from "@nimimo/resolve"

try {
  await nimimo.cancelIntent("int_...")
} catch (err) {
  if (err instanceof IntentExpired) { /* ... */ }
}
```

## Full reference

See [nimimo.com/docs](https://nimimo.com/docs) for the complete v1 API
reference, error matrix, and end-to-end examples.

## License

MIT
