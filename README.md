<p align="center">
  <img src="public/logo.png" alt="nimimo" width="120" />
</p>

<h1 align="center">nimimo</h1>

<p align="center">
  <b>Non-custodial crypto identity for humans.</b><br/>
  Built in the open, by one person, over many months.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="AGPL-3.0" /></a>
  <img src="https://img.shields.io/badge/tests-169%2F169-brightgreen" alt="Tests passing" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/chains-BTC%20%7C%20ETH%20%7C%20SOL-orange" alt="Bitcoin Ethereum Solana" />
</p>

---

## Why this is here

I built nimimo because I wanted the layer to exist.

Crypto could feel like email. You send to `@cool-water` and it works - the way you'd send a message. The keys are yours, generated in your browser, and the server has no power over them. Identity, ownership, recovery, and access are four separate things that can each be replaced independently without taking the others down.

That's the system I designed on paper first. **The four-axes and sixteen-states formalism was written on December 18, 2025 and circulated to peers on Telegram in the days that followed — before this repo existed.** Months of implementation followed, against that spec. The code in this repo is the working-out of the papers, not a post-hoc story told over a finished codebase. Anyone who wants to check the order of work can read the architecture papers as the design contract and the code as the implementation against it; the file-creation timestamps on the original drafts, the December 2025 chat threads in which they were shared, and this repo's commit history all line up the way you'd expect. Originals available on request.

Read the code. Run it. The cryptographic layer is right here, every line of it. The server never holds a key.

---

## The Problem

Crypto today assumes users will memorize seed phrases, pick the right chain, accept irreversible mistakes, or hand their keys to a custodian with KYC.

This has produced an industry where usability problems are blamed on users, loss is normalized, and custody is reintroduced as a "solution."

**nimimo rejects this model.**

You send crypto to **`@cool-water`**, not to `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh`.

Keys are generated in your browser. The server never sees them. Ever.

---

## The Architecture: Four Axes, Sixteen States

nimimo separates four independent axes that most crypto systems collapse into one:

| Axis | What it controls | Who holds authority |
|------|-----------------|-------------------|
| **Access** | How you log in (OAuth, Magic Link) | Session-based, ephemeral |
| **Identity** | Your human-readable name (`@cool-water`) | You own it |
| **Ownership** | Your cryptographic keys (BTC, ETH, SOL) | Your browser. Only your browser. |
| **Recovery** | Encrypted backup to restore everything | Your password + your QR code |

This separation is not a product feature. It is the product.

### The Sixteen States

Every cryptographic identity system exists in one of **16 possible states** - the combinations of having or lacking each axis. I formalized all of them.

Most systems live in collapsed states where axes are entangled:

| State | What it means | Who lives here |
|-------|--------------|----------------|
| **(1,1,0,0)** | Access collapsed into ownership | Custodial exchanges |
| **(1,1,1,0)** | Full account collapse, no recovery | "Not your keys, not your coins" |
| **(0,1,0,0)** | Ownership without access | Raw seed phrase, unusable UX |

**nimimo targets (1,1,1,1) - the Separated Full State.** The only state where all four axes coexist without collapsing into each other. Recovery rotation without re-keying. Identity without locking ownership. Access without central authority.

Every crypto system that has failed its users operationally was stuck in one of the 15 collapsed states.

> *The full 16-state analysis: [docs/architecture/sixteen-states.md](docs/architecture/sixteen-states.md)*

---

## Why This Is Different

### The server cannot betray you

A full database breach of nimimo exposes public addresses and email addresses. **No funds can be stolen.** Not because I promise to protect them - because the keys were never on the server in the first place.

- Mnemonics: AES-256-GCM encryption, stored only on user device (IndexedDB)
- Device keys: PBKDF2-SHA256, 600,000 iterations, never transmitted
- Recovery: user-chosen password, encrypted locally, never touches the server
- Transactions: signed client-side, broadcast through the user's own RPC

nimimo cannot be subpoenaed into producing keys it never held. It cannot be coerced into reversing transactions it never settled. It cannot be compromised into draining accounts whose ownership material was never on its servers. This is not a compliance posture. It is an architectural property.

### Non-features are commitments, not gaps

Every feature nimimo refuses to build is a deliberate choice to preserve the four-axis separation:

| Will never ship | Why |
|-------------------|-----|
| Token / ICO | Creates misaligned stakeholders |
| Swap / Exchange | Puts ownership axis in value path |
| Custodial fallback | The feature whose absence the entire architecture exists to guarantee |
| Account recovery via support | There is no account in the custodial sense |
| KYC / Identity verification | nimimo never does the regulated activity in the first place |
| Fiat on-ramp | Would introduce regulatory obligations that compromise the design |

---

## What this is not

People sometimes lump nimimo in with the things below. Here's where the lines actually are.

### Not ENS (or Unstoppable Domains, or `.crypto`)

ENS maps `name.eth` to a single Ethereum address, on-chain. It costs gas to register, renews on a paid annual cycle, and the name itself is a tradable asset - auctioned, squatted, resold. Cross-chain support is bolted on with TXT records and resolver contracts that most wallets don't read.

nimimo resolves a single handle to **BTC, ETH, and SOL** addresses simultaneously. It costs nothing. It lives off-chain, so the handle is never tradeable, never gas-priced, never auctioned. The handle is yours because the cryptographic ownership is yours - not because you outbid someone.

### Not a browser wallet (MetaMask, Phantom, Rabby)

Browser wallets are extensions. They sit in the browser's sidebar, manage keys per-chain, and the send flow is "paste a `0x…`."

nimimo is the layer **above** the wallet. It runs at a URL - no extension to install - gives you a handle across BTC / ETH / SOL at once, and replaces "paste an address" with "send to `@cool-water`." You can use a browser wallet alongside it; nimimo doesn't replace MetaMask's signing UX, it replaces the address book.

### Not a custodial wallet or exchange

Custodial wallets hold your keys. nimimo cannot hold them - they're generated in your browser, encrypted with a key derived from your password, and never transmitted to the server. A full database breach exposes public addresses and email addresses. Nothing transferable. This is an architectural property, not a promise.

### Not a social protocol (Lens, Farcaster)

Social protocols couple identity to a social graph and to an on-chain token. Your handle is a `profileNFT` - tradeable, taxable, tied to one network's economics, and only as portable as that network is.

nimimo's identity has no on-chain footprint, no token, no graph, no platform. It's a name pointing at a key. Nothing more.

### Not an app

There's no app to install. No app-store review cycle, no platform tax, no "you must update before continuing." nimimo is a website. Open it on your phone, tablet, or laptop - same flow, same code, same identity.

The recovery file is the part most people miss: it's a **password-encrypted QR code (with a printable PDF backup) that you can import on any device**. Scan it on your desktop and you're signed in to the same identity in seconds. Multi-session works the way it does on every other website. No "pair this device with your phone" handshake. No re-derivation, no chain-by-chain re-import.

---

## The link is the product

The actual user-facing surface isn't the handle by itself, it's the URL.

`nimimo.com/@chris` is one shareable link you paste into your X bio, Instagram, email signature, business card. Anyone who clicks it lands on a page where they can send you BTC, ETH, or SOL with one tap. No install. No chain to choose. No copy-paste of a hex address. It works on a phone. It works on a desktop. It works for someone who has never used crypto.

That makes it a crossover the existing tools haven't quite covered at once:

- **Linktree, but for money.** One link in your bio, except instead of a list of social profiles it resolves to your actual blockchain addresses.
- **Venmo / PayPal, but non-custodial.** Send to a name, not an address. Unlike Venmo, no one is holding the funds, the money goes straight to the recipient's wallet and only they can move it.
- **Patreon / OnlyFans, but without a platform between you and the money.** On nimimo.com the same `@handle` link can host tip presets, gated content, and paid posts. Payment goes directly to the creator's wallet. No platform cut, no T&Cs that can be revoked, no "your account has been suspended."

This repo gives you the link, the resolver, and the payment-receive surface. nimimo.com layers tips and gated content on top, and lets you upgrade a free handle like `@cool-water` to a vanity one like `@chris`.

---

## The Regulatory Posture

Most regulatory categories attach to a specific operational primitive: holding customer funds, transmitting value, matching trades, issuing securities, operating accounts. The four-axis separation makes those primitives structurally absent from nimimo.

- **Money Transmitter:** nimimo never accepts or transmits funds
- **VASP (FATF):** No exchange, transfer, hold, or administration
- **CASP (MiCA/EU):** Keys are device-local; nimimo has no mechanism to hold crypto-assets
- **KYC/AML:** nimimo performs none of the regulated activities

If a regulator examines nimimo, the goal is for the examination to be uneventful - not because anything is hidden, but because there is nothing to find.

---

## Run It Yourself

```bash
git clone https://github.com/chriszemmel/nimimo-core.git
cd nimimo-core
pnpm install
pnpm dev
```

This is the **complete application**. Not a demo. Not a subset. The same code that runs nimimo.com.

---

## SDK

```bash
npm install @nimimo/resolve
```

```typescript
import { NimimoClient } from "@nimimo/resolve"

const nimimo = new NimimoClient()
const { addresses } = await nimimo.resolve("cool-water")
// { bitcoin: "bc1q...", ethereum: "0x...", solana: "..." }
```

MIT-licensed. Zero dependencies. 3KB gzipped. Integrate into any wallet.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript 5.9 |
| Crypto | @noble/curves, @scure/bip32, bip39, ethers, tweetnacl |
| Database | PostgreSQL (Neon Serverless) |
| Cache | Upstash Redis (3-tier rate limiting) |
| Auth | NextAuth (Google OAuth + Email Magic Link) |
| Storage | Cloudflare R2 |
| RPCs | Alchemy, Blockstream, Cloudflare, 1RPC |
| Testing | Vitest - 169 tests, 0 failures |
| CI | GitHub Actions (lint + typecheck + test + build) |
| Built with | Claude Code |

Built solo over many months. Independently bootstrapped to v1.0.0. No token. One person, accountable by name.

---

## What's in this repo

A complete, self-hostable nimimo node, AGPL-3.0:

- Authentication & sessions
- Identity creation & resolution
- Client-side key derivation (BTC / ETH / SOL)
- Wallet - balance, send, receive, history
- Recovery - QR + PDF + password encryption
- Public resolution API + the `@nimimo/resolve` SDK
- 4 profile templates
- Multi-language (EN / DE / ES / ZH)
- All blockchain adapters

The repo runs standalone. Clone, set env vars, `pnpm dev`. The SDK at `packages/resolve` is MIT - integrate freely.

> **Note on maintenance:** this repo is the v1.0.0 snapshot of the core architecture and isn't receiving further updates. The live product at nimimo.com continues to evolve, but the open-source `nimimo-core` is frozen as a reference implementation. Forks are welcome.

The live product at **[nimimo.com](https://nimimo.com)** runs this same core plus features that aren't part of the open-source release - custom-chain support beyond BTC/ETH/SOL (Enjin Relay/Matrix and Base today, more on the way), creator monetization (tips, gated content), brand tooling, and a few things still in flight. The core is open. nimimo.com is the active product, and it's still growing.

I chose AGPL because trust requires transparency. If you run a modified nimimo as a service, you must share your changes. Every deployment handling user keys must be auditable.

---

## Commercial Licensing

nimimo is dual-licensed. AGPL-3.0 keeps the open commons honest. A commercial license is available for organizations whose business model is incompatible with the AGPL share-alike obligation — which is most paying customers.

You need the commercial license if you:

- Embed nimimo in a closed-source product
- Run a modified nimimo as a hosted service for your customers
- Distribute the resolver inside a proprietary SDK or wallet
- Want a contract, indemnification, and SLA instead of a community license

### Who this is built for

Concrete fits, in rough order of how cleanly the architecture matches:

- **Exchanges and crypto neobanks** — white-label non-custodial receive layer. Keep your custodial product; give every customer a `@handle` link their friends can pay without installing your app.
- **Payroll and contractor-payment platforms** (Bitwage-, Deel-style flows) — `@handle` instead of address paste removes the single largest source of payroll-rail support tickets.
- **Creator-economy platforms** — tip and gated-content links that route directly to the creator's wallet, with no platform-as-custodian step.
- **Remittance corridors** — recipients hand out a name, not a 42-character address, and the rail stays non-custodial end-to-end.
- **Telcos and messaging apps** — add a "send money" surface without crossing into money-transmitter territory, because no funds touch your servers.
- **Governments and central banks running retail CBDC pilots** — the four-axis separation is exactly the *architectural compliance* posture the [regulatory paper](docs/architecture/regulatory-posture.md) describes.
- **Banks** — narrower fit, real at the corners: corporate-treasury self-custody, employee crypto-payroll rails, private-bank handle directories for crypto-curious wealth clients.

### What the commercial license includes

- Commercial-use rights: closed-source derivatives, hosted services, OEM and white-label distribution
- A signed dual-license agreement that replaces the AGPL share-alike obligation
- Patent grant covering the four-axis architecture and the resolver protocol
- Trademark usage guidelines for "Powered by nimimo" attribution
- Eligibility for the paid services listed below

### Paid services on top of the license

- **Hosted resolver** — managed `@handle` resolution with SLA, geo-distributed, audited
- **Audited builds** — third-party-reviewed, signed builds of the cryptographic layer for high-assurance deployments
- **Custom chain integrations** — beyond BTC / ETH / SOL: Base, Enjin Relay/Matrix, your L2, your CBDC pilot
- **Security retainer** — incident response, threat-model reviews, key-handling audits
- **Implementation support** — design-partner engagement during integration

### Indicative pricing

| Tier | Annual license | Fits |
|------|----------------|------|
| **Startup** | from $50k | Single product, < 100k MAU, community support |
| **Production** | $150k–$500k | Unlimited MAU, SLA, audited builds, named support |
| **Enterprise** | $500k+ | Source escrow, custom chains, security retainer, on-call |
| **Sovereign / CBDC** | bespoke | Architectural-compliance review, jurisdiction-specific build, deployment partnership |

Ranges are starting points. Final pricing depends on chains, MAU, SLA shape, and support depth. Multi-year and design-partner discounts available.

### Design partner program

A small number of design-partner slots are open at a discount in exchange for public reference status and a seat at the table on the commercial roadmap. If you're an exchange, neobank, payroll platform, creator platform, or central-bank pilot and the architecture matches your problem, this is the cleanest way in.

### Talk to us

Commercial licensing, design-partner inquiries, custom integration, or just the pricing PDF: **[chris@nimimo.com](mailto:chris@nimimo.com)** with `[license]` in the subject. Same-day reply on weekdays.

---

## The Ethics

> *"If a value matters, it should be enforced by the shape of the system, not by the promises of the people running it."*

The architecture is the ethics.

---

## Architecture Papers

The formal design documents that define nimimo's approach:

- [**The Four Axes**](docs/architecture/four-axes.md) - Access, Identity, Ownership, Recovery
- [**The Sixteen States**](docs/architecture/sixteen-states.md) - Complete state space of cryptographic identity
- [**The Access Primitive**](docs/architecture/access-primitive.md) - Session-based auth without authority escalation
- [**Regulatory Posture**](docs/architecture/regulatory-posture.md) - Architecture as compliance
- [**Ethics**](docs/architecture/ethics.md) - Why the design choices are moral choices

---

## Get in touch

I'm Chris. I built nimimo solo because the architecture wouldn't leave me alone.

I'm at a point in my life where I'd genuinely value stability, and I'm open to a lot of shapes to get there. **Hire me full-time onto your team. Bring me on as a contractor or advisor. License nimimo for your exchange, neobank, or wallet. Build something with me. Fund nimimo's next chapter.** Full-time, fractional, freelance, partnership — if it lets me keep building thoughtfully, I'm interested.

If you're at **Coinbase, Kraken, Stripe, a neobank, an exchange, a wallet, a creator platform, or anywhere the four-axis problem is sitting unsolved in your stack** — I'd like to talk. The architecture in this repo is a strong signal of how I think; the live product is a stronger signal of how I ship.

Systems thinking is the thread. Designing how the parts fit together so the whole holds up — that's what I do. nimimo is one expression; the same approach has carried me through financial tooling, medical tooling, AI integrations, data pipelines, and dashboards. Anywhere the architecture has to hold the product up. The architecture papers above are a more honest portfolio than any CV — read them, then write to me.

Outside of work, I'd love to hear from anyone who builds carefully and quietly. Argue about the sixteen states. Tell me about something you shipped that nobody noticed yet. Send a hello if any of this resonated. It's lonely here.

Email **[chris@nimimo.com](mailto:chris@nimimo.com)** · X **[@fungible_chris](https://x.com/fungible_chris)** · GitHub **[chriszemmel](https://github.com/chriszemmel)**

---

<p align="center">
  <img src="public/logo.png" alt="nimimo" width="40" />
  <br/>
  <b>nimimo</b><br/>
  <i>Crypto, built for humans.</i><br/>
  <br/>
  <a href="https://nimimo.com">nimimo.com</a> · <a href="https://x.com/getnimimo">@getnimimo</a> · <a href="docs/architecture/sixteen-states.md">16 States</a> · <a href="docs/architecture/ethics.md">Ethics</a>
</p>
