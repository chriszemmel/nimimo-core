# Regulatory Posture

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../CITATION.cff)

*This document describes nimimo's structural design intent and is not
legal advice. The claims below are properties of the architecture, not
opinions about how any specific law applies in any specific
jurisdiction. Readers seeking legal advice should consult qualified
counsel in their jurisdiction.*

---

## Premise

Most regulatory categories that apply to crypto products attach to a
specific operational primitive: holding customer funds, transmitting
value on behalf of users, matching trades, issuing securities, or
operating accounts. The four-axis separation defined in
[`four-axes.md`](./four-axes.md) makes those primitives structurally
absent from nimimo. This is not a compliance posture; it is an
architectural property.

The Access axis carries no authority. The Ownership axis is
cryptographic and lives only on the user's device. The Identity axis
is purely referential and never signs. The Recovery axis is
user-controlled, encrypted, and never touched by the server. There is
no point in the system at which nimimo holds, controls, moves,
matches, issues, or invests anything.

The rest of this document walks through specific regulatory
categories and explains, for each, the structural reason nimimo does
not perform the regulated activity. The point is not "we comply"; the
point is "we never do the thing in the first place".

---

## Money transmitter (US state level)

A money transmitter accepts funds from one party and transmits them
to another. nimimo never accepts funds. No transaction in the system
routes through a nimimo-controlled key, account, or address. When a
sender pays a nimimo handle, the sender's wallet signs a direct
on-chain transaction to a public address derived from the recipient's
own ownership material. nimimo is the resolver, not the carrier.

The Ownership axis is cryptographically isolated from both Access and
Identity. Even if every server nimimo operates were compromised, no
user funds could be moved, because the keys that authorize movement
have never existed off the user's device.

## Money Services Business: FinCEN (US federal)

FinCEN registration as an MSB attaches to entities that are money
transmitters, currency dealers, check cashers, prepaid access
providers, or similar. nimimo is none of these. It does not exchange
currency, does not issue prepaid value, does not deal in fiat
instruments, and does not transmit value as defined above.

The Identity axis is the only thing nimimo "operates", and identity
in nimimo is a name that points at user-owned addresses. Operating a
naming resolver is not a money services activity.

## Crypto-Asset Service Provider: MiCA (EU)

MiCA's CASP definition is built around custody, exchange, transfer,
placement, advice, portfolio management, and similar services
performed *for or on behalf of* clients. nimimo performs none of
these. The Ownership axis lives on the user's device; nimimo cannot
hold crypto-assets on behalf of clients because it has no mechanism
to hold them at all.

Specifically, nimimo does not provide:

- Custody and administration of crypto-assets. Keys are device-local
  and never transmitted.
- Operation of a trading platform. There is no order book, no
  matching engine, no venue.
- Exchange of crypto-assets for funds or other crypto-assets. No
  exchange logic exists in the system.
- Execution of orders, placement, or transfer services. nimimo never
  executes anything; the user's own wallet executes.
- Reception, transmission, or advice. nimimo offers no advice and
  receives no orders.

## Virtual Asset Service Provider: FATF Recommendation 15

The FATF VASP definition mirrors MiCA's CASP for the purposes of
international AML standards. The same structural reasoning applies:
nimimo does not exchange, transfer, hold, administer, or participate
in the issuance of virtual assets on behalf of users. It resolves a
human-readable name to a public address that the user themselves
controls.

## Payment processor / payment institution

Payment processing requires the operator to sit in the value path.
nimimo does not. A payment to `@lucky-mountain` is an ordinary
on-chain transfer from the sender's wallet to the recipient's
self-custodied address. nimimo never settles, clears, holds float,
issues authorization, or guarantees a transaction. The handle is a
lookup; settlement is whatever the underlying chain does.

## Exchange / trading venue

An exchange matches buyers and sellers and operates an order book.
nimimo has no order book, no quotes, no matching engine, no spread,
no concept of "trading pairs", and no fees on trades. Two users
cannot exchange one asset for another inside nimimo, because nimimo
has no trade primitive.

## Creator monetization (tips, paid content)

nimimo profiles can receive tips and sell content (images, documents,
links) for on-chain payment. These features do not change the
regulatory analysis above. The structural properties are:

1. **Tips** are direct on-chain transfers from the sender's wallet to
   the creator's self-custodied address. nimimo resolves the name and
   presents a payment surface; the transaction is signed by the
   sender's own keys and settled by the chain. No value passes
   through nimimo. No fee is collected.

2. **Paid content** follows the same path: the sender pays the
   creator's address directly. The creator sets a price in USD; the
   sender pays the equivalent in the chain's native asset. nimimo
   verifies the on-chain payment and grants access to the content.
   No fee is currently collected.

3. **Intents** are structured payment requests that third-party
   applications can create via the public API. An intent is a
   record pointing at a recipient handle, a chain, and an amount.
   It resolves to the same direct on-chain transfer described above.
   nimimo creates the intent record; the sender's wallet executes
   and signs the transaction.

In all three cases nimimo remains the resolver, not the carrier.
The sender's wallet signs the transaction, the chain settles it,
and the recipient's self-custodied address receives the funds.
nimimo never holds, routes, or intermediates value.

If a platform fee is introduced in the future, the regulatory
implications of that fee structure will be assessed and documented
separately. The current architecture is fee-free.

## Securities issuer / broker-dealer

nimimo has no token. There is no claim, no equity, no governance
right, no profit share, no investment contract, and no expectation of
return tied to anything nimimo does. The product is a free identity
layer. There is nothing to issue, nothing to broker, and nothing to
deal.

## E-money institution

E-money institutions issue electronic value redeemable at par. nimimo
does not issue value of any kind. The chains nimimo resolves to
(Bitcoin, Ethereum, Solana) issue their native assets independently;
nimimo neither issues nor redeems any of them.

## KYC / AML obligated entity

KYC and AML obligations attach to entities performing regulated
activities (custody, transmission, exchange, etc.). Because nimimo
performs none of those, it is not the obligated entity for those
activities. nimimo collects an email at sign-up to enable Access; the
email is not tied to any value flow because there is no value flow.

This is not a claim that AML rules are irrelevant in crypto generally.
They apply to whoever is actually performing the regulated activity,
which in nimimo's case is *the wallet the sender already uses*, not
nimimo.

## Banking / deposit-taking

Deposit-taking requires accepting funds from the public on a
repayable basis. nimimo accepts no funds. There is nothing to repay
because nothing was ever taken.

## Investment adviser / portfolio manager

Investment advice involves making personalized recommendations about
securities or assets. nimimo makes no recommendations and manages no
portfolios. The Identity axis does not constitute advice.

---

## What the four axes guarantee

The structural guarantee is simple and follows directly from the
axis separation:

1. **Access** carries no authority. A compromised access method
   cannot move funds, change identity, or trigger recovery.
2. **Ownership** is cryptographic and device-local. nimimo has no
   mechanism to hold, move, or restore it.
3. **Identity** is referential. It points at ownership but cannot
   override it.
4. **Recovery** is user-initiated, locally encrypted, and
   access-independent. nimimo cannot generate or apply a recovery
   artifact.

The full state-space analysis in
[`sixteen-states.md`](./sixteen-states.md) shows why every collapsed
state, meaning the states in which one axis acquires authority over
another, is exactly the configuration that creates regulated activity.
nimimo maintains the only state in which all four axes coexist
without collapse: `(1,1,1,1)`, the Separated Full State.

---

## On investigation

If a regulator, auditor, or counterparty examines nimimo, the goal
is for the examination to be uneventful. Not because nimimo has
hidden anything, but because the architecture was designed so there
is nothing to find. The keys are not on the server. The funds are
not in nimimo's custody. The orders are not matched in nimimo's
backend. The token does not exist. The advice is not given. The
deposits are not taken.

This is what a clean separation of concerns looks like applied to a
domain that has historically refused to separate them. It is the
state crypto identity should have been in from the start.
