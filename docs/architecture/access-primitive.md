# Access Without Authority: Session-Based Interaction in Sovereign Cryptographic Systems

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../CITATION.cff)

## Abstract

This paper formalizes the concept of non-authoritative access in
non-custodial cryptographic systems. Access enables session
continuity, device portability, and usability without granting
authority over identity, ownership, or assets. By separating access
from authority, systems can scale to non-expert users without
introducing custodial control or hidden trust assumptions.

---

## 1. Problem Statement

Cryptographic systems traditionally expose ownership primitives
directly to users. While this ensures sovereignty, it creates
significant usability barriers. Attempts to reduce friction often
collapse access and authority, leading to custodial behavior and
implicit trust models that undermine decentralization.

## 2. Design Goals

- Enable session continuity across devices and environments.
- Allow user recognition without key exposure.
- Support recoverability workflows without authority escalation.
- Preserve strict non-custodial guarantees.
- Ensure access remains replaceable, revocable, and ephemeral.

## 3. Defining Access

Access is defined as the ability to interact with system interfaces
and initiate actions. It is explicitly non-authoritative and cannot
perform cryptographic decisions.

**Access may:**
- Authenticate a session.
- Display identity and balance information.
- Initiate ownership requests.

**Access may not:**
- Sign transactions.
- Mutate ownership bindings.
- Reassign identity.
- Recover assets independently.

## 4. Access as a Session Primitive

Access is modeled as a session-bound capability. Sessions are
time-limited, device-scoped, and revocable. They exist solely to
improve usability and carry no long-term authority.

## 5. Authentication Without Authority

Authentication mechanisms such as email login, passkeys, or OAuth
establish sessions but do not confer ownership or identity control.
Authentication proves presence, not authority.

## 6. Access and Identity Interaction

Access interacts with identity in a read-only manner. It may resolve
names, display identity metadata, and present routing information,
but it cannot create, destroy, or modify identity bindings.

## 7. Access and Ownership Interaction

Access may request ownership actions but cannot perform them.
Ownership authorization is required for all actions that mutate value
routing, resolver state, or asset control.

## 8. Failure Modes of Collapsed Access

Systems that collapse access and authority exhibit common failure
modes, including account takeover, forced recovery, and silent
custodial intervention. These failures stem from allowing access to
mutate authoritative state.

## 9. Recovery Is Not Access

Recovery mechanisms are often implemented as elevated access. This is
incorrect. Recovery must reconstitute ownership without bypassing
cryptographic guarantees or granting unilateral authority.

## 10. Comparison to Existing Models

| System              | Access Model    | Authority Boundary | Result                  |
| ------------------- | --------------- | ------------------ | ----------------------- |
| Wallets             | Implicit        | Collapsed          | High usability friction |
| Custodial Platforms | Account-based   | Centralized        | Custody risk            |
| Social Wallets      | Blended         | Escalating         | Hidden custody          |
| This Model          | Session-based   | Explicit           | Sovereign usability     |

## 11. Security Invariants

- Access expiration does not affect ownership.
- Access compromise does not imply asset loss.
- Access revocation does not destroy identity.
- Access replacement does not transfer authority.

## 12. Conclusion

Separating access from authority is essential for building usable yet
sovereign cryptographic systems. By formalizing access as a
non-authoritative session primitive, systems can scale to mainstream
users without sacrificing decentralization or introducing custodial
risk.
