# The 16-State Interaction Space of Access, Ownership, Identity, and Recovery

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../CITATION.cff)

This document provides a dense, system-level analysis of all sixteen
possible combinations of **Access (A)**, **Ownership (O)**,
**Identity (I)**, and **Recovery (R)**. Rather than isolating them as
trivial cases, each state is examined as an equilibrium under human,
operational, and economic pressure.

States are written as binary tuples `(A, O, I, R)`. The four axes are
defined in [`four-axes.md`](./four-axes.md).

---

## (0,0,0,0): Null State

This state represents the absence of any cryptographic or social
system. There is no user, no ownership, no reference, and no recovery.
It is included for completeness as the origin state from which all
others emerge. nimimo does not operate here.

## (1,0,0,0): Access Without Ownership

A user can initiate a session through an access mechanism, but no
cryptographic ownership, identity, or recovery exists. This mirrors
traditional web onboarding. In nimimo, this state is intentionally
transient and immediately followed by local ownership generation.

## (0,1,0,0): Ownership Without Access

Cryptographic keys exist without an interface. While sovereign, this
state is unusable for most humans. nimimo avoids exposing users
directly to this by adding access abstraction without authority.

## (0,0,1,0): Identity Without Ownership

A human-readable identity exists without cryptographic backing. This
creates semantic authority without control, which historically leads
to centralization. nimimo forbids identity creation before ownership.

## (0,0,0,1): Recovery Without Target

Recovery exists without anything to recover. This state is logically
incoherent and prevented in nimimo by design.

## (1,1,0,0): Access Collapsed Into Ownership

Access directly controls ownership. Losing access means losing funds.
This is the hallmark of custodial systems. nimimo structurally
prevents this collapse.

## (1,0,1,0): Identity Collapsed Into Access

Identity exists only within a specific access provider, creating
platform lock-in. nimimo binds identity to ownership instead.

## (1,0,0,1): Recovery Collapsed Into Access

Recovery depends on access providers, introducing reset authority.
nimimo recovery artifacts are user-controlled and access-independent.

## (0,1,1,0): Identity Collapsed Into Ownership

Identity becomes authoritative over ownership, leading to
account-style control. nimimo treats identity purely as referential.

## (0,1,0,1): Recovery Collapsed Into Ownership

Recovery can override ownership, breaking cryptographic finality.
nimimo recovery requires possession of encrypted artifacts.

## (0,0,1,1): Identity Reset Systems

Identity can be restored without ownership, creating centralized
identity authority. nimimo cryptographically binds identity to
ownership.

## (1,1,1,0): Full Account Collapse

Access, identity, and ownership collapse into a single authority.
This is classical custody. nimimo rejects this architecture.

## (1,1,0,1): Managed Wallet Systems

Ownership exists but access and recovery override it. nimimo forbids
any recovery override of ownership.

## (1,0,1,1): Deferred Ownership Systems

Identity and access exist before ownership. Whoever introduces
ownership later controls it. nimimo generates ownership immediately
and locally.

## (0,1,1,1): Sovereign but Inhuman

All elements exist except access abstraction. Users reintroduce
access, collapsing the system. nimimo adds access without collapsing
authority.

## (1,1,1,1): Separated Full State

All four axes coexist without collapse. Access is replaceable,
identity is referential, ownership is final, and recovery is optional.
This is the state nimimo maintains.
