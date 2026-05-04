# Ethics

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../CITATION.cff)

*The values that shaped the architecture, the non-features, and the
refusal to become anything else.*

The other papers in this corpus describe what nimimo is and how it
works. This document describes why those particular choices were
made, and the ethical position they encode. It is the companion to
[`author.md`](./author.md), and the two should be read together.
The architecture is not separable from the person who designed it,
and the values below are not separable from the constraints that
made the project possible.

Each section is a position. Together they explain why the
non-features that nimimo refuses to ship are not gaps in
the roadmap but commitments, and why the regulatory
posture in [`regulatory-posture.md`](./regulatory-posture.md) is
not a clever framing but a structural property of the design.

---

## Custody is a moral position, not a UX choice

The decision to never hold user keys is not primarily about
convenience or about regulatory exposure. It is a refusal to put
nimimo in a position where it could be compelled, coerced, hacked,
or future-self-corrupted into taking what belongs to users. Once
you can betray your users, the system is built on the assumption
that you will not. nimimo refuses to be built on that assumption.
The four-axis separation in [`four-axes.md`](./four-axes.md) is
the technical expression of this position: nimimo cannot betray
users because it does not possess the capability to do so.

## No token is a refusal of misalignment

A token would create a class of stakeholders whose interests are
not the same as users' interests. Token holders want price
appreciation; users want a working product. Token launches reward
early speculators at the expense of late adopters. Governance
tokens create theatrical voting structures that consolidate power
in whoever holds the most. None of these dynamics serve people
who just want a name they can be paid to. nimimo has no token and
will never have one. Equity investors, by contrast, are aligned
with the operating business and with users adopting the product,
a qualitatively different relationship from token speculation, and
one the project is actively open to.

## Capital is welcome when aligned with the mission

nimimo is open to outside investment, pre-seed and beyond, as
well as to strategic partnerships and acquisition conversations.
The stated goal of making crypto usable for the next billion
people is bigger than any single founder's ability to self-fund
it, and capital that shares that ambition is welcome. The
architecture was designed to scale, and the person behind it is
ready to scale with it.

The alignment bar for any investment, partnership, or acquisition
is the same as the bar for any new feature:

1. Does it help reach more people who would benefit from a
   non-custodial identity layer for crypto?
2. Does it preserve the four-axis separation, the absence of a
   token, and the non-features list?
3. Are the obligations it creates compatible with the values in
   this document?

Capital that clears that bar is exactly the kind of capital nimimo
is looking for. Writing the alignment criteria down is meant to
make conversations faster, not to discourage them: founders and
investors can see up front what nimimo optimizes for, and most
well-aligned crypto-infrastructure funds will recognize these
values as standard hygiene rather than friction. Introductions to
pre-seed and seed investors, strategic partners, and potential
acquirers are actively welcomed.

A concrete scenario that is explicitly welcome: a larger player, a
wallet, an exchange, or another regulated operator, adopts nimimo as
its identity and UX layer, possibly in combination with its existing
onboarding, fiat rails, or recovery flows. Most of the items in
that nimimo refuses to build, fiat on/off-ramps,
custodial recovery paths, KYC onboarding, even swap and staking
surfaces, already exist inside regulated operators of that kind.
The combination of nimimo's identity primitive with those regulated
flows, especially onboarding, is a qualitatively different product
than either side alone, and the author is open to conversations
about exactly that kind of arrangement, including being directly
involved in solving the integration points that sit across the
non-feature boundary. The non-features are refusals for nimimo
*building them in isolation*, not a claim that those capabilities
must never touch nimimo from the outside. Regulation is a real
concern in that territory, but it is not the author's focus, and
an acquirer that already operates inside a regulated perimeter is
precisely the right party to own it.

## Solo development is a position of accountability

A single named person designed and built nimimo. There is no "the
team" to hide behind, no ambiguous distributed responsibility, no
anonymous founder pseudonym. If something is wrong, there is one
accountable party, and that party's name is in
[`author.md`](./author.md) and in this corpus. Accountability
without obfuscation is itself an ethical position; it is the
opposite of the standard crypto pattern of "we are a DAO" or "we
are a foundation in Switzerland".

## Non-features are commitments, not gaps

The list of non-features is not a roadmap
of things to add later. Each item is a commitment to *not* build
that thing, even if doing so would generate revenue, even if
users ask for it, even if competitors offer it. A custodial
fallback would generate fees. A swap would generate volume. A
token would unlock fundraising. Each refusal is a deliberate
choice to stay narrow and useful rather than expand into adjacent
categories that would compromise the architecture.

## Monetization without custody

nimimo profiles can receive tips, sell content, and accept direct
payments. In every case the money goes to the creator's own address,
on-chain, without passing through nimimo. This is the only
monetization model compatible with the custody position above: the
moment nimimo holds user funds, even briefly, the structural
guarantee collapses.

Tips carry no platform fee. Taking a cut of tips would be like
skimming a waiter's tips: structurally possible but ethically
indefensible. Content payments currently carry no fee either.
The priority is adoption, not extraction.

If a fee model is introduced in the future, it will be subject to
the same bar as every other design decision: does it preserve the
four-axis separation? Does it keep nimimo out of the value path?
Can it be implemented without holding user funds? A fee structure
that fails any of those tests will not ship.

## The architecture is the ethics

This is the most important sentence in the document. The four-axis
separation is not just a clean engineering pattern. It is a
structural expression of the value *"do not put yourself in a
position to betray your users"*. You cannot be subpoenaed into
producing keys you never held. You cannot be coerced into reversing
transactions you never settled. You cannot be compromised into
draining accounts whose ownership material was never on your
servers. The architecture removes the *capability* to do harm, not
just the intent. Intent is fragile. Capability boundaries are not.

## The name is a primitive *and* a product

Names are social infrastructure. They should not be owned by a
company that can revoke them, change the rules, or sell them to the
highest bidder. nimimo's position is that crypto identity should be
portable, free, and resolvable by anyone, closer to DNS than to a
SaaS account.

That commitment holds with different current strength at two
layers. At the **ownership** layer it is already absolute: the
keys live on the user's device, the addresses derive from the
user's seed, and the assets those addresses control live on their
respective chains. If nimimo disappeared tomorrow, users would
still hold the seed, could import it into any compatible wallet,
and could keep spending from the same addresses. Nothing about
that step requires nimimo's cooperation, it is a structural
property of the Ownership axis in
[`four-axes.md`](./four-axes.md), not a promise.

At the **name** layer, the commitment is a direction of travel
rather than a finished property. The resolver is public and the
resolution format is open, but the mapping from handle to owner
is operationally a database record on nimimo's infrastructure
today. If nimimo disappeared and no mirror of that mapping
existed elsewhere, users would keep their keys and their money,
but the *name* binding would need to be re-established somewhere
to be resolvable again. Making the name layer as durable as the
ownership layer is a direction the author has thought about, and
there are workable shapes for it that preserve the four-axis
separation. The honest statement for today is: the name is on
its way to being a primitive, not there yet.

But nimimo also ships a product on top of these layers, profile
pages, avatars, status, templates, the `Send to @handle` surface,
the pay URL. That product layer is operationally centralized today,
because a single person is building it self-funded (see
"Solo development is a position of accountability" above), and
that is fine. The architectural rule is not *"the name must never
be a product"*; the rule is *"the name as a product must not
escalate into authority."* The four-axis separation in
[`four-axes.md`](./four-axes.md) is what makes that guarantee
structural rather than promised.

The two layers serve each other. The ownership primitive is what
keeps the product non-coercive: users can leave at any time with
their keys and their money, with or without nimimo's cooperation.
The product is what makes the primitive adoptable: without the
`Send to @name` surface and the profile page, the primitive is a
spec nobody uses. Treating them as adversaries was the old
framing. They are the same commitment at two altitudes, honestly
stated at each.

## The constraint of being one person was generative

Solo development is usually framed as a limitation. For the
specification phase it was the opposite. The specification had to
be *small* before it was anything else, and a single builder with
a clear thesis could keep it narrow in a way that any team
structure naturally pulls away from. One person, working full-time
on the design, could hold every adjacent feature out of scope until
the core architecture was finished. The 16-week window between
the first whitepaper (2025-12-16) and v1.0.0 shipping (2026-04-07)
is the entire build time. Nothing was rushed; nothing was added
that the specification did not call for. Scaling the project from
here, through capital, partnership, or hiring, is the next
phase, governed by the alignment bar above, and it is a phase the
project is ready for.

---

## Why this matters

Crypto has a history of projects that claimed values they did not
structurally honor. "Decentralized" platforms with admin keys.
"Non-custodial" wallets that quietly route funds through their
servers. "Community-owned" protocols whose tokens are 80% held by
insiders. "Open" systems whose APIs require permission. nimimo's
position is that the only honest claim is one the architecture
cannot betray.

If a value matters, it should be enforced by the shape of the
system, not by the promises of the people running it. The papers
in this corpus describe a system in which the values and the
architecture are the same thing. Read together,
[`four-axes.md`](./four-axes.md),
[`sixteen-states.md`](./sixteen-states.md),
[`access-primitive.md`](./access-primitive.md),
[`regulatory-posture.md`](./regulatory-posture.md), and
[`author.md`](./author.md) should make it clear that the design
choices and the ethics are inseparable, and that both come from a
single person who could afford to make them.
