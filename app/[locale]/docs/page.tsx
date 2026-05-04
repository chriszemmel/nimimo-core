import type { Metadata } from "next"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "./copy-button"
import { TryResolve } from "./try-resolve"

export const metadata: Metadata = {
  title: "Developer Docs | nimimo",
  description:
    "Integrate the nimimo v1 API. Resolve human-readable handles to Bitcoin, Ethereum, and Solana addresses, and create payment intents that users sign in their own wallet.",
  robots: { index: false, follow: false },
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-muted/20 border-b border-border/40 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            {title}
          </span>
          <CopyButton text={children} />
        </div>
      )}
      {!title && (
        <div className="relative group">
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={children} />
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-foreground/90 bg-background/50 leading-relaxed">
            <code>{children}</code>
          </pre>
        </div>
      )}
      {title && (
        <pre className="p-4 overflow-x-auto text-sm font-mono text-foreground/90 bg-background/50 leading-relaxed">
          <code>{children}</code>
        </pre>
      )}
    </div>
  )
}

function Endpoint({
  method,
  path,
  description,
}: {
  method: string
  path: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="shrink-0 mt-0.5 inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary font-mono">
        {method}
      </span>
      <div>
        <code className="text-sm font-mono text-foreground/90">{path}</code>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  )
}

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto space-y-10">
            {/* Header */}
            <div className="space-y-3">
              <h1
                className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Developer Docs
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                The nimimo v1 API lets you resolve handles to blockchain
                addresses and create payment intents that users sign in their
                own wallet. Public, CORS-enabled, no authentication required
                for the read endpoints.
              </p>
            </div>

            {/* Overview */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                How it works
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every nimimo user has a human-readable handle like{" "}
                <code className="text-primary">@neat-gecko</code>. Behind that
                handle are receiving addresses for Bitcoin, Ethereum, and
                Solana. The <strong>resolve</strong> endpoint lets you look up
                those addresses programmatically. The <strong>intents</strong>{" "}
                endpoints let you create a payment record on the server that
                the user signs in their own wallet via a sign URL - useful for
                invoices, agents, and third-party checkout.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Public", detail: "No API key or auth required" },
                  { label: "Cross-origin", detail: "CORS enabled for browser use" },
                  { label: "Rate limited", detail: "Per-IP, headers on every response" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border/40 p-3 space-y-1"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Base URL */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Base URL
              </h2>
              <CodeBlock>{`https://nimimo.com/api/v1`}</CodeBlock>
              <p className="text-xs text-muted-foreground">
                All endpoints are versioned. The current version is{" "}
                <code>v1</code>.
              </p>
            </section>

            {/* Endpoints */}
            <section className="space-y-6">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Endpoints
              </h2>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Handle Resolution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Endpoint
                    method="GET"
                    path="/resolve?handle={handle}"
                    description="Resolve a handle to all registered addresses"
                  />
                  <Endpoint
                    method="GET"
                    path="/resolve?handle={handle}&chain={chain}"
                    description="Resolve a handle to a specific chain address"
                  />
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">
                      Supported chains:
                    </span>{" "}
                    <code>bitcoin</code>, <code>ethereum</code>,{" "}
                    <code>solana</code>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Intents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Endpoint
                    method="POST"
                    path="/intents"
                    description="Create a payment intent for a handle. Returns an intent_id and sign_url."
                  />
                  <Endpoint
                    method="GET"
                    path="/intents/{id}"
                    description="Retrieve the current status and details of an intent."
                  />
                  <Endpoint
                    method="PATCH"
                    path="/intents/{id}"
                    description="Update an intent: mark as signed, completed (with tx_hash), or cancelled."
                  />
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground/70">
                      State machine:
                    </span>{" "}
                    <code>awaiting_signature</code> →{" "}
                    <code>signed</code> → <code>completed</code>. Both{" "}
                    <code>awaiting_signature</code> and <code>signed</code> can
                    transition to <code>cancelled</code>. An intent past its{" "}
                    <code>expires_at</code> auto-transitions to{" "}
                    <code>expired</code> on the next read or write. Terminal
                    states (<code>completed</code>, <code>cancelled</code>,{" "}
                    <code>expired</code>) cannot be changed.
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Try it */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Try it
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Test the API right here. The default handle{" "}
                <code className="text-primary">neat-gecko</code> is a real
                nimimo identity - hit send and see the live response.
              </p>
              <TryResolve />
            </section>

            {/* Example: All chains */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Resolve all chains
              </h2>
              <CodeBlock title="Request">
                {`GET https://nimimo.com/api/v1/resolve?handle=neat-gecko`}
              </CodeBlock>
              <CodeBlock title="Response  200">
                {`{
  "handle": "neat-gecko",
  "addresses": {
    "bitcoin": "bc1qz3yaratxc9z6wz2pj2k97nzl00l4cucpvcquq9",
    "ethereum": "0x874a40B1857B006d46b80c9e6badCEF3BA3B705C",
    "solana": "9rhN3eug2LbqZKCtbkGRKjRq9BVa4Y5VE4Puf2p4HCRk"
  }
}`}
              </CodeBlock>
            </section>

            {/* Example: Single chain */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Resolve a single chain
              </h2>
              <CodeBlock title="Request">
                {`GET https://nimimo.com/api/v1/resolve?handle=neat-gecko&chain=bitcoin`}
              </CodeBlock>
              <CodeBlock title="Response  200">
                {`{
  "handle": "neat-gecko",
  "chain": "bitcoin",
  "address": "bc1qz3yaratxc9z6wz2pj2k97nzl00l4cucpvcquq9"
}`}
              </CodeBlock>
            </section>

            {/* Example: Create intent */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Create a payment intent
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A payment intent is a server-side record of an intended
                transfer. The recipient handle is resolved server-side, the
                amount is preserved as a human-readable string (no unit
                conversion), and the response includes a{" "}
                <code>sign_url</code> the payer opens to sign in their wallet.
                Only <code>to</code>, <code>chain</code>, and{" "}
                <code>amount</code> are required.
              </p>
              <CodeBlock title="Request">
                {`POST https://nimimo.com/api/v1/intents
Content-Type: application/json

{
  "from": "@agent",                       // optional
  "to": "@neat-gecko",                    // required
  "chain": "ethereum",                    // bitcoin | ethereum | solana
  "asset": "ETH",                         // optional, inferred from chain
  "amount": "0.05",                       // required, human-readable
  "memo": "Design payment",               // optional, max 500 chars
  "expires_at": "2026-04-15T12:00:00Z"   // optional ISO-8601, defaults to +1h
}`}
              </CodeBlock>
              <CodeBlock title="Response  201">
                {`{
  "intent_id": "int_9x21abc...",
  "status": "awaiting_signature",
  "to_handle": "@neat-gecko",
  "to_address": "0x874a40B1857B006d46b80c9e6badCEF3BA3B705C",
  "to_avatar": "https://nimimo.com/api/avatar?seed=neat-gecko",
  "chain": "ethereum",
  "asset": "ETH",
  "amount": "0.05",
  "memo": "Design payment",
  "sign_url": "https://nimimo.com/sign/int_9x21abc...",
  "expires_at": "2026-04-15T12:00:00.000Z",
  "created_at": "2026-04-14T12:00:00.000Z"
}`}
              </CodeBlock>
            </section>

            {/* Example: Get intent */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Check intent status
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Poll this endpoint to track the lifecycle. If the intent is
                still <code>awaiting_signature</code> and past{" "}
                <code>expires_at</code>, the read auto-transitions it to{" "}
                <code>expired</code>.
              </p>
              <CodeBlock title="Request">
                {`GET https://nimimo.com/api/v1/intents/int_9x21abc...`}
              </CodeBlock>
              <CodeBlock title="Response  200">
                {`{
  "intent_id": "int_9x21abc...",
  "status": "signed",
  "from": "@agent",
  "to_handle": "@neat-gecko",
  "to_address": "0x874a40B1857B006d46b80c9e6badCEF3BA3B705C",
  "to_avatar": "https://nimimo.com/api/avatar?seed=neat-gecko",
  "chain": "ethereum",
  "asset": "ETH",
  "amount": "0.05",
  "memo": "Design payment",
  "tx_hash": null,
  "sign_url": "https://nimimo.com/sign/int_9x21abc...",
  "expires_at": "2026-04-15T12:00:00.000Z",
  "created_at": "2026-04-14T12:00:00.000Z",
  "updated_at": "2026-04-14T12:05:00.000Z"
}`}
              </CodeBlock>
            </section>

            {/* Example: Update intent */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Update or cancel an intent
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Transition an intent through the state machine. The signing UI
                at <code>sign_url</code> handles{" "}
                <code>signed</code> and <code>completed</code> automatically
                when the user signs and broadcasts. You normally only call this
                endpoint directly to <code>cancel</code> an intent. When
                marking <code>completed</code>, <code>tx_hash</code> is
                required.
              </p>
              <CodeBlock title="Cancel">
                {`PATCH https://nimimo.com/api/v1/intents/int_9x21abc...
Content-Type: application/json

{ "status": "cancelled" }`}
              </CodeBlock>
              <CodeBlock title="Mark completed">
                {`PATCH https://nimimo.com/api/v1/intents/int_9x21abc...
Content-Type: application/json

{
  "status": "completed",
  "tx_hash": "0xabc123..."
}`}
              </CodeBlock>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Returns the full intent object (same shape as{" "}
                <code>GET /intents/{`{id}`}</code>). Returns <code>409</code>{" "}
                <code>invalid_transition</code> if the requested transition
                isn&apos;t allowed by the state machine, or <code>410</code>{" "}
                <code>intent_expired</code> if the intent has already expired.
              </p>
            </section>

            {/* Code examples */}
            <section className="space-y-6">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Quick start
              </h2>

              <div className="space-y-4">
                <CodeBlock title="JavaScript / TypeScript">
                  {`async function resolveHandle(handle) {
  const res = await fetch(
    \`https://nimimo.com/api/v1/resolve?handle=\${handle}\`
  )
  if (!res.ok) throw new Error("Resolution failed")
  return res.json()
}

const { addresses } = await resolveHandle("neat-gecko")
console.log(addresses.bitcoin)
// "bc1qz3yaratxc9z6wz2pj2k97nzl00l4cucpvcquq9"`}
                </CodeBlock>

                <CodeBlock title="Python">
                  {`import requests

def resolve_handle(handle, chain=None):
    params = {"handle": handle}
    if chain:
        params["chain"] = chain
    r = requests.get("https://nimimo.com/api/v1/resolve", params=params)
    r.raise_for_status()
    return r.json()

result = resolve_handle("neat-gecko")
print(result["addresses"]["ethereum"])
# "0x874a40B1857B006d46b80c9e6badCEF3BA3B705C"`}
                </CodeBlock>

                <CodeBlock title="cURL">
                  {`curl "https://nimimo.com/api/v1/resolve?handle=neat-gecko"

# Single chain
curl "https://nimimo.com/api/v1/resolve?handle=neat-gecko&chain=solana"`}
                </CodeBlock>

                <CodeBlock title="JavaScript / TypeScript - intent flow">
                  {`// 1. Create the intent
const create = await fetch("https://nimimo.com/api/v1/intents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: "@neat-gecko",
    chain: "ethereum",
    amount: "0.05",
    memo: "Invoice #1042",
  }),
})
const intent = await create.json()

// 2. Send the user to intent.sign_url to sign in their wallet
window.open(intent.sign_url, "_blank")

// 3. Poll for completion
const poll = setInterval(async () => {
  const res = await fetch(\`https://nimimo.com/api/v1/intents/\${intent.intent_id}\`)
  const status = await res.json()
  if (["completed", "cancelled", "expired"].includes(status.status)) {
    clearInterval(poll)
    if (status.status === "completed") console.log("Paid:", status.tx_hash)
  }
}, 3000)`}
                </CodeBlock>

                <CodeBlock title="cURL - intent flow">
                  {`# Create
curl -X POST https://nimimo.com/api/v1/intents \\
  -H "Content-Type: application/json" \\
  -d '{ "to": "@neat-gecko", "chain": "ethereum", "amount": "0.05" }'

# Check status
curl https://nimimo.com/api/v1/intents/int_9x21abc...

# Cancel
curl -X PATCH https://nimimo.com/api/v1/intents/int_9x21abc... \\
  -H "Content-Type: application/json" \\
  -d '{ "status": "cancelled" }'`}
                </CodeBlock>
              </div>
            </section>

            {/* Errors */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Error responses
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All errors return a JSON object with <code>error</code> and{" "}
                <code>message</code> fields.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/10">
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">
                        Error
                      </th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">
                        Meaning
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[
                      ["400", "invalid_handle", "Handle is malformed or empty (resolve)"],
                      [
                        "400",
                        "invalid_chain",
                        "Chain not supported (use bitcoin, ethereum, or solana)",
                      ],
                      ["400", "invalid_body", "Request body is not valid JSON (intents)"],
                      [
                        "400",
                        "invalid_id",
                        "Intent ID must start with int_ (intents)",
                      ],
                      [
                        "400",
                        "Validation failed",
                        "Body parsed but failed schema validation; details in the response",
                      ],
                      ["404", "not_found", "Handle or intent does not exist"],
                      [
                        "404",
                        "no_address",
                        "Handle exists but has no address for the requested chain",
                      ],
                      [
                        "409",
                        "invalid_transition",
                        "Illegal intent state transition (e.g. cancel an already-completed intent)",
                      ],
                      [
                        "410",
                        "intent_expired",
                        "Intent is past its expires_at and can no longer be updated",
                      ],
                      [
                        "429",
                        "\u2014",
                        "Rate limit exceeded; honor the Retry-After header",
                      ],
                      [
                        "500",
                        "internal_error",
                        "Server error; safe to retry with backoff",
                      ],
                    ].map(([status, error, meaning]) => (
                      <tr key={error}>
                        <td className="py-2 px-4 font-mono text-xs text-foreground/80">
                          {status}
                        </td>
                        <td className="py-2 px-4 font-mono text-xs text-primary/80">
                          {error}
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          {meaning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CodeBlock title="Example error response">
                {`{
  "error": "not_found",
  "message": "Handle not found"
}`}
              </CodeBlock>
            </section>

            {/* Handle format */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Handle format
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Handles are lowercase alphanumeric strings with optional
                hyphens. They always start with a letter. When displayed to
                users, prefix with <code>@</code>.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div className="rounded-lg border border-border/40 p-3 flex items-center gap-2">
                  <span className="text-green-400 text-xs">Valid</span>
                  <code className="text-muted-foreground">neat-gecko</code>
                </div>
                <div className="rounded-lg border border-border/40 p-3 flex items-center gap-2">
                  <span className="text-green-400 text-xs">Valid</span>
                  <code className="text-muted-foreground">lucky-mountain-42</code>
                </div>
                <div className="rounded-lg border border-border/40 p-3 flex items-center gap-2">
                  <span className="text-red-400 text-xs">Invalid</span>
                  <code className="text-muted-foreground">123-bad</code>
                </div>
                <div className="rounded-lg border border-border/40 p-3 flex items-center gap-2">
                  <span className="text-red-400 text-xs">Invalid</span>
                  <code className="text-muted-foreground">Cool-Water</code>
                </div>
              </div>
            </section>

            {/* Rate limiting */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Rate limiting
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The v1 API is rate-limited per IP address. Limits are
                per-endpoint:
              </p>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/10">
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">
                        Endpoint
                      </th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">
                        Limit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[
                      ["GET /resolve", "30 requests / 60 seconds"],
                      ["POST /intents", "30 requests / 60 seconds"],
                      ["GET /intents/{id}", "30 requests / 60 seconds"],
                      ["PATCH /intents/{id}", "30 requests / 60 seconds"],
                    ].map(([endpoint, limit]) => (
                      <tr key={endpoint}>
                        <td className="py-2 px-4 font-mono text-xs text-foreground/80">
                          {endpoint}
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          {limit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every API response carries the current limit state in headers:
              </p>
              <CodeBlock>
                {`X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1712073600000`}
              </CodeBlock>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When you exceed the limit, the API returns HTTP <code>429</code>{" "}
                with a <code>Retry-After</code> header (seconds). The official
                SDK retries 429s with exponential backoff for resolve calls; for
                intents calls you should handle 429 in your own retry loop.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you need higher limits for a production integration, get in
                touch.
              </p>
            </section>

            {/* SDK */}
            <section className="space-y-6">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                TypeScript SDK
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The official SDK wraps the v1 API with typed responses,
                automatic retries, caching, and payment helpers. Zero runtime
                dependencies, ~5KB minified, dual ESM/CJS, full TypeScript
                types. Currently published as <code>0.1.0</code>.
              </p>

              <CodeBlock title="Install">
                {`npm install @nimimo/resolve`}
              </CodeBlock>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Initialize</h3>
                <CodeBlock title="Setup">
                  {`import { NimimoClient } from "@nimimo/resolve"

const nimimo = new NimimoClient()

// Optional: custom config
const nimimo = new NimimoClient({
  baseUrl: "https://nimimo.com",  // default; SDK appends /api/v1 internally
  maxRetries: 2,                  // retries on 429 with exponential backoff
  cacheTtl: 30_000,               // 30s in-memory cache for resolve()
})`}
                </CodeBlock>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Resolve handles</h3>
                <CodeBlock title="Single handle - all chains">
                  {`const { handle, addresses } = await nimimo.resolve("neat-gecko")

console.log(addresses.bitcoin)
// "bc1qz3yaratxc9z6wz2pj2k97nzl00l4cucpvcquq9"

console.log(addresses.ethereum)
// "0x874a40B1857B006d46b80c9e6badCEF3BA3B705C"

console.log(addresses.solana)
// "9rhN3eug2LbqZKCtbkGRKjRq9BVa4Y5VE4Puf2p4HCRk"`}
                </CodeBlock>
                <CodeBlock title="Single handle - specific chain">
                  {`const { address } = await nimimo.resolve("neat-gecko", "bitcoin")
// "bc1qz3yaratxc9z6wz2pj2k97nzl00l4cucpvcquq9"`}
                </CodeBlock>
                <CodeBlock title="Batch resolve">
                  {`const results = await nimimo.resolveMany(["neat-gecko", "lucky-mountain"])
// [
//   { handle: "neat-gecko", addresses: { bitcoin: "bc1q...", ... } },
//   { handle: "lucky-mountain", addresses: { bitcoin: "bc1q...", ... } }
// ]`}
                </CodeBlock>
                <CodeBlock title="Check if a handle exists">
                  {`const exists = await nimimo.exists("neat-gecko")  // true
const nope = await nimimo.exists("nonexistent")   // false`}
                </CodeBlock>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Client-side payment helper
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <code>paymentIntent()</code> is a local helper that resolves
                  the recipient and converts the amount to the chain&apos;s
                  smallest unit (wei, satoshis, lamports). It does{" "}
                  <strong>not</strong> hit the <code>/intents</code>{" "}
                  endpoints - nothing is stored server-side. Use it when your
                  app already owns the signing flow.
                </p>
                <CodeBlock title="Build a wallet-ready transaction">
                  {`const intent = await nimimo.paymentIntent("neat-gecko", {
  chain: "ethereum",
  amount: "0.05",  // ETH
})

// intent = {
//   to: "0x874a40B1857B006d46b80c9e6badCEF3BA3B705C",
//   value: "50000000000000000",  // wei
//   chain: "ethereum",
//   amount: "0.05",
//   handle: "neat-gecko",
// }

// Use with ethers.js
await signer.sendTransaction({ to: intent.to, value: intent.value })

// Use with wagmi/viem
await sendTransaction({ to: intent.to, value: intent.value })`}
                </CodeBlock>
                <CodeBlock title="Bitcoin">
                  {`const intent = await nimimo.paymentIntent("neat-gecko", {
  chain: "bitcoin",
  amount: "0.001",  // BTC
})
// intent.to    → "bc1qz3yaratxc9z6wz2pj2k97nzl00l4cucpvcquq9"
// intent.value → "100000" (satoshis)`}
                </CodeBlock>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Server-side intents (with sign URL)
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  These methods talk to the <code>/intents</code> endpoints.
                  Use them when the signer is a different person than the
                  caller - invoices, agent payments, third-party checkout. The
                  payer signs at <code>sign_url</code> in their own wallet.
                </p>
                <CodeBlock title="Create, poll, cancel">
                  {`import { NimimoClient, IntentNotFound, IntentExpired } from "@nimimo/resolve"

const nimimo = new NimimoClient()

// Create
const created = await nimimo.createIntent({
  to: "@neat-gecko",
  chain: "ethereum",
  amount: "0.05",
  memo: "Invoice #1042",
  // from, asset, expires_at are optional
})

console.log(created.intent_id)   // "int_9x21abc..."
console.log(created.sign_url)    // "https://nimimo.com/sign/int_9x21abc..."
console.log(created.status)      // "awaiting_signature"

// Poll
const intent = await nimimo.getIntent(created.intent_id)
if (intent.status === "completed") {
  console.log("Paid:", intent.tx_hash)
}

// Cancel
try {
  await nimimo.cancelIntent(created.intent_id)
} catch (err) {
  if (err instanceof IntentExpired) {
    console.log("Already expired")
  } else if (err instanceof IntentNotFound) {
    console.log("No such intent")
  }
}`}
                </CodeBlock>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Pay URLs</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Generate shareable payment links. No SDK needed on the
                  receiving end - the link opens the nimimo profile with a
                  pre-filled payment flow.
                </p>
                <CodeBlock title="Generate a pay URL">
                  {`const url = nimimo.payUrl("neat-gecko", {
  chain: "ethereum",
  amount: "0.05",
})
// "https://nimimo.com/@neat-gecko?pay=0.05&chain=ethereum"

// Drop it in an invoice, a bio, or a chat message.
// Anyone who clicks it can pay from any wallet.`}
                </CodeBlock>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Error handling</h3>
                <CodeBlock title="Typed errors">
                  {`import { NimimoClient, HandleNotFound, NoAddress, RateLimited } from "@nimimo/resolve"

try {
  const result = await nimimo.resolve("nonexistent-handle")
} catch (err) {
  if (err instanceof HandleNotFound) {
    console.log("Handle doesn't exist")
  } else if (err instanceof NoAddress) {
    console.log("No address for this chain")
  } else if (err instanceof RateLimited) {
    console.log("Too many requests - SDK auto-retries with backoff")
  }
}`}
                </CodeBlock>
              </div>

              <div className="rounded-lg border border-border/40 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">SDK features</p>
                <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
                  <li>Full TypeScript types for all v1 responses and errors</li>
                  <li>Automatic retry with exponential backoff on 429 (resolve only)</li>
                  <li>In-memory cache for resolve with configurable TTL (default 30s)</li>
                  <li>Batch resolution for multiple handles in one call</li>
                  <li>Client-side payment helper with unit conversion (ETH to wei, BTC to sat, SOL to lamports)</li>
                  <li>Server-side intents: <code>createIntent</code>, <code>getIntent</code>, <code>cancelIntent</code></li>
                  <li>Pay URL generation for zero-code payment links</li>
                  <li>
                    Typed error classes: <code>HandleNotFound</code>,{" "}
                    <code>NoAddress</code>, <code>InvalidHandle</code>,{" "}
                    <code>InvalidChain</code>, <code>IntentNotFound</code>,{" "}
                    <code>IntentExpired</code>, <code>InvalidTransition</code>,{" "}
                    <code>RateLimited</code>
                  </li>
                  <li>~5KB minified, zero runtime dependencies, dual ESM/CJS</li>
                </ul>
              </div>
            </section>

            {/* Use cases */}
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Use cases
              </h2>
              <div className="space-y-3">
                {[
                  {
                    title: "Payment integrations",
                    detail:
                      "Let users pay to a @handle instead of copying a raw address. Resolve the handle, show the address, and initiate the transaction.",
                  },
                  {
                    title: "Invoices & checkout",
                    detail:
                      "Create a payment intent server-side and email or display the sign URL. The payer signs in their own wallet; you poll the intent for completion and tx_hash.",
                  },
                  {
                    title: "Agent payments",
                    detail:
                      "Let an automated agent (bot, service, or AI) propose a payment without ever holding keys. Create the intent, hand the sign URL to the human in the loop, and wait for them to sign.",
                  },
                  {
                    title: "Contact books",
                    detail:
                      "Store nimimo handles as contacts and resolve addresses on demand. Addresses update automatically when users rotate keys.",
                  },
                  {
                    title: "Multi-chain apps",
                    detail:
                      "Resolve a single handle to Bitcoin, Ethereum, and Solana addresses simultaneously. No chain selection needed from the user.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-border/40 p-4 space-y-1"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Footer note */}
            <div className="pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                This API is provided as-is. nimimo reserves the right to
                adjust rate limits or deprecate endpoints with reasonable
                notice.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
