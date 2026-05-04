# The Four Axes of nimimo

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../CITATION.cff)

*A structured explanation of Access, Ownership, Identity, and Recovery.*

## Overview

nimimo is designed around a deliberate separation of four fundamental
axes required for human interaction with cryptographic systems. These
axes are **Access**, **Ownership**, **Identity**, and **Recovery**.
Each axis serves a distinct role and is intentionally prevented from
escalating authority into another.

This document defines each axis. The companion papers
[`sixteen-states.md`](./sixteen-states.md) and
[`access-primitive.md`](./access-primitive.md) examine, respectively,
the full state space of the four axes and the formal properties of the
Access axis in isolation.

---

## 1. Access

**Definition.** Access is the ability to initiate a session within
nimimo on a specific device.

- Access enables interaction with the interface but does not grant
  authority.
- Access methods are replaceable and non-persistent.
- Loss of access does not imply loss of ownership.

```ts
// lib/auth.ts - NextAuth session callback
async session({ session, user }) {
  if (session.user && user) {
    session.user.id = user.id
  }
  return session
},
```

The session callback is the only place a session object is assembled for
the client. It attaches an opaque `user.id` and nothing else, no keys,
no signing material, no ambient authority.

## 2. Ownership

**Definition.** Ownership is cryptographic control over private keys
generated and stored locally on the user's device.

- Includes private keys and derived wallet addresses (protocol
  identities).
- Keys are never transmitted to or stored by nimimo.
- Ownership exists independently of access or identity.

```ts
// lib/ownership/v1/derive.ts - multi-chain address derivation, runs on the user's device
export async function deriveV1Addresses(seedPhrase: string): Promise<AddressDerivationResult> {
  try {
    const seed = await bip39.mnemonicToSeed(seedPhrase)
    const masterKey = HDKey.fromMasterSeed(new Uint8Array(seed))

    const addresses: DerivedAddress[] = []

    for (const chain of MANDATORY_V1_CHAINS) {
      let address: string
      if (chain.chain === "bitcoin") {
        const hdKey = masterKey.derive(chain.derivationPath)
        address = await deriveBitcoinAddress(hdKey)
      } else if (chain.chain === "ethereum") {
        address = await deriveEthereumAddress(seedPhrase, chain.derivationPath)
      } else if (chain.chain === "solana") {
        address = await deriveSolanaAddress(new Uint8Array(seed))
      } else {
        throw new Error(`Unsupported chain: ${chain.chain}`)
      }
      addresses.push({ chain: chain.chain, symbol: chain.symbol, name: chain.name,
                       address, derivationPath: chain.derivationPath, logo: chain.logo })
    }

    return { success: true, addresses }
  } catch (error) {
    return { success: false, addresses: [], error: String(error) }
  }
}
```

The seed phrase enters this function in the browser and never leaves.
It is fed into BIP-32 / ed25519 derivation for Bitcoin, Ethereum, and
Solana, and only the public addresses are returned to the page.

## 3. Identity

**Definition.** Identity is a human-readable reference that resolves
to cryptographic ownership.

- Usernames and profiles act as social pointers, not authority.
- Identity is persistent across access methods.
- Identity does not sign transactions or hold balances.

**Referential is not peripheral.** The statement that identity has
no cryptographic authority is a *safety* property, not a *priority*
ranking. Identity is the surface users actually touch: the handle
they share, the profile they customize, the `@name` a payer types.
Ownership is the cryptographic invariant beneath it. Both layers are
load-bearing; they carry different loads. The separation in this
document prevents identity from *becoming* authority, it does not
demote identity to plumbing.

```ts
// packages/resolve/src/client.ts - public resolve() in the @nimimo/resolve SDK, a pure read
async resolve(handle: string): Promise<ResolveAllResult>
async resolve(handle: string, chain: Chain): Promise<ResolveSingleResult>

async resolve(
  handle: string,
  chain?: Chain,
): Promise<ResolveAllResult | ResolveSingleResult> {
  const params = new URLSearchParams({ handle })
  if (chain) params.set("chain", chain)
  const url = `${this.baseUrl}/api/v1/resolve?${params}`
  return this.fetchWithRetry(url)
}
```

Third-party wallets and apps call `resolve(handle)` to look up addresses.
The SDK hits the read-only `/api/v1/resolve` endpoint and returns. It
never signs, never holds funds, never authenticates, identity is a
pointer, not an authority.

## 4. Recovery

**Definition.** Recovery is an optional, user-initiated export of
encrypted ownership material.

- Recovery artifacts are created locally and encrypted with a
  user-chosen password.
- nimimo never stores or manages recovery material.
- Recovery adds portability but introduces user responsibility.

```ts
// lib/recovery/crypto.ts - password-derived key using PBKDF2 + AES-GCM, all in the browser
export async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const pinBytes = encoder.encode(pin)

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", pinBytes, "PBKDF2", false, ["deriveKey"]
  )

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 600000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}
```

The password is stretched with 600,000 rounds of PBKDF2-SHA-256, then
bound to an AES-256-GCM key for symmetric encryption of the recovery
payload. Every call to `window.crypto.subtle` runs in the user's browser;
the password never crosses the network, and the server has nothing to
forget. (The internal parameter is named `pin` for historical reasons,
a PIN is a special case of a password; the implementation accepts any
string.)

---

## Axis Comparison Table

| Axis      | Purpose            | Cryptographic Authority |
| --------- | ------------------ | ----------------------- |
| Access    | Enter system       | None                    |
| Ownership | Control value      | Funds only              |
| Identity  | Human reference    | None                    |
| Recovery  | Restore ownership  | None                    |

"Cryptographic Authority: None" means the axis cannot sign, mutate
state, or move value on its own. It does not mean the axis is
unimportant to the product. Identity, in particular, carries none of
the cryptographic authority *and* most of the product surface, that
combination is the point, not an accident.

By separating these axes, nimimo achieves human usability without
introducing custody or authority. Each axis exists independently, yet
interoperates through well-defined, non-escalating boundaries.
