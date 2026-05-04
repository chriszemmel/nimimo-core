"use client"

import { useRef, useEffect, useMemo, useState, useCallback } from "react"
import Image from "next/image"
import { ChevronDown, ArrowRight, Heart } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"

import { Footer } from "@/components/footer"
import { JsonLd } from "@/components/json-ld"
import { getAllTemplates } from "@/components/profile/templates"
import type { TemplateProps } from "@/components/profile/templates"
import { SITE_URL } from "@/lib/site-config"

export default function HomePage() {
  const t = useTranslations("landing")
  const contentRef = useRef<HTMLElement | null>(null)

  // How-it-works steps, identity facts, and security trust signals now
  // live in the message catalog (messages/{locale}.json → landing.how /
  // landing.identity / landing.security). The step numbers are a UI
  // convention so we keep them in code; the copy is translated.
  const how = [
    { step: "01", title: t("how.step1Title"), body: t("how.step1Body") },
    { step: "02", title: t("how.step2Title"), body: t("how.step2Body") },
    { step: "03", title: t("how.step3Title"), body: t("how.step3Body") },
  ]
  const identityFacts = [
    { title: t("identity.fact1Title"), body: t("identity.fact1Body") },
    { title: t("identity.fact2Title"), body: t("identity.fact2Body") },
    { title: t("identity.fact3Title"), body: t("identity.fact3Body") },
    { title: t("identity.fact4Title"), body: t("identity.fact4Body") },
  ]
  const earnFeatures = [
    { title: t("earn.feature1Title"), body: t("earn.feature1Body") },
    { title: t("earn.feature2Title"), body: t("earn.feature2Body") },
    { title: t("earn.feature3Title"), body: t("earn.feature3Body") },
  ]
  const trustSignals = [
    { title: t("security.trust1Title"), body: t("security.trust1Body") },
    { title: t("security.trust2Title"), body: t("security.trust2Body") },
  ]

  const scrollToContent = () => {
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const publishedHighlights = useMemo(
    () => BLOG_HIGHLIGHTS.filter((a) => new Date(a.publishedAt) <= new Date()),
    [],
  )

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    )
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <main className="flex flex-col bg-background overflow-x-hidden scroll-smooth">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "nimimo",
          url: SITE_URL,
          description:
            "A simple way to receive crypto. Share a name instead of a wallet address - anyone can send you money. Self-custody by default.",
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/@{handle}`,
            "query-input": "required name=handle",
          },
        }}
      />

      {/* Organization + founder structured data so search engines and AI
          knowledge graphs (Google, Bing, ChatGPT Search, Perplexity)
          identify nimimo unambiguously and attribute authorship. Avoids
          confusion with the unrelated "minimo" aluminum wallet brand. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": "https://nimimo.com/#organization",
          name: "nimimo",
          alternateName: "nimimo.com",
          url: SITE_URL,
          logo: `${SITE_URL}/logo.png`,
          description:
            "nimimo is a simple way to receive crypto using a name instead of a wallet address. Sign up with an email and get a name like @lucky-mountain plus a link at nimimo.com/@lucky-mountain. Anyone can send you money - across Bitcoin, Ethereum, and Solana. Self-custody by default: keys are generated on the user's device and never leave it. Free, no token.",
          foundingDate: "2025-12-16",
          founder: {
            "@type": "Person",
            "@id": "https://nimimo.com/about#chris",
            name: "Chris Zemmel",
            jobTitle: "Systems Founder",
            url: `${SITE_URL}/about`,
            sameAs: [
              "https://github.com/chriszemmel",
              "https://x.com/getnimimo",
            ],
          },
          sameAs: ["https://x.com/getnimimo"],
          knowsAbout: [
            "crypto identity",
            "self-custody wallets",
            "non-custodial cryptography",
            "crypto payments",
            "Bitcoin",
            "Ethereum",
            "Solana",
          ],
        }}
      />

      {/* SoftwareApplication structured data. Pins the product
          category as "identity layer", not "wallet". */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "nimimo",
          applicationCategory: "Creator Tools & Identity",
          operatingSystem: "Web",
          url: SITE_URL,
          description:
            "A simple way to receive crypto. Share a name instead of a wallet address. One shareable link for Bitcoin, Ethereum, and Solana. Self-custody by default; keys never leave the user's device.",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          author: {
            "@type": "Person",
            "@id": "https://nimimo.com/about#chris",
            name: "Chris Zemmel",
            jobTitle: "Systems Founder",
            url: `${SITE_URL}/about`,
            sameAs: [
              "https://github.com/chriszemmel",
              "https://x.com/getnimimo",
            ],
          },
        }}
      />

      {/* ─────────────────────────── HERO ─────────────────────────── */}
      {/*
        Hero sizing: grid of `[content 1fr] [scroll-indicator auto]` with
        a MIN height of the static small-viewport minus the fixed header.
        `svh` is the *static* small-viewport height - it does not change
        when the mobile browser chrome animates in/out, so no JS
        measurement / freeze is needed to prevent layout shift when e.g.
        the Instagram in-app browser linkbar appears. An earlier version
        of this page measured `offsetHeight` in a `useEffect` and froze
        the value in state; that freeze was removed in v1.2.0 because
        the useEffect started firing inside next-intl's client hydration
        window and was capturing the wrong pixel value (iOS Safari's URL
        bar was still animating, so `svh` briefly resolved near `lvh`
        and the hero was frozen ~100px taller than the viewport - logo
        shifted down, scroll chevron clipped behind Safari's bottom bar).
        Plain CSS is enough now, and was enough before the freeze too.

        `minHeight` (not `height`): on a phone held in landscape the
        usable height drops to ~290px, which is not enough to fit logo +
        title + subline + trust + CTA. With a fixed `height` the content
        overflowed the section, bleeding the next section's border into
        the hero and visually detaching the scroll indicator from the
        bottom. `minHeight` keeps the full-viewport feel in portrait
        while letting the section grow to contain its content in
        landscape, so the chevron + gradient separator stay locked at
        the bottom of the hero in both orientations.
      */}
      <section
        className="relative grid text-center px-6 bg-background"
        style={{
          gridTemplateRows: "1fr auto",
          minHeight: "calc(100svh - 3.5rem)",
        }}
      >
        <div className="flex flex-col items-center justify-center gap-6 sm:gap-5 lg:gap-6 pb-6 px-2">
          {/* Logo */}
          <div className="relative w-40 h-40 sm:w-32 sm:h-32 lg:w-36 lg:h-36">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-2xl"
              style={{
                background: "radial-gradient(circle, rgba(136,109,249,0.2) 0%, rgba(69,230,209,0.1) 55%, transparent 80%)",
                transform: "scale(1.6)",
                opacity: 0.5,
              }}
            />
            <Image
              src="/logo.png"
              alt="nimimo logo"
              width={160}
              height={160}
              priority
              className="relative object-contain w-full h-full"
              style={{
                filter: "drop-shadow(0 0 18px rgba(136,109,249,0.3))",
              }}
            />
          </div>

          <div className="flex flex-col items-center gap-3 sm:gap-2">
            <h1
              className="text-4xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-display)", lineHeight: 1.1 }}
            >
              {t("hero.headline")}
            </h1>
            <p className="text-base sm:text-sm lg:text-base text-muted-foreground max-w-sm text-center leading-relaxed">
              {t("hero.subheadLine2")}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <p
                className="text-sm font-bold text-brand-gradient tracking-wide"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("hero.tagline")}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {t("hero.timePromise")}
              </p>
            </div>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-[#0d0d2b] w-full max-w-[17rem] h-11 px-8 text-sm transition-transform hover:scale-105 active:scale-95 mt-4"
              style={{
                background: "linear-gradient(90deg, #45e6d1 0%, #41c6e9 40%, #7c5ce6 80%, #7f3db9 100%)",
                boxShadow: "0 0 28px rgba(136,109,249,0.38)",
              }}
            >
              {t("hero.cta")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex flex-col items-center justify-end py-2 gap-1">
          <button
            onClick={scrollToContent}
            aria-label={t("hero.scrollAria")}
            className="p-2 text-muted-foreground/60 hover:text-primary transition-colors animate-bounce"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="w-px h-4 bg-gradient-to-b from-border to-transparent" />
        </div>
      </section>

      {/* ─────────────────────────── HOW IT WORKS ─────────────────────────── */}
      <section
        ref={contentRef}
        className="scroll-mt-14 py-24 px-6 border-t border-border bg-card/20"
      >
        <div className="max-w-4xl mx-auto">
          <p className="reveal text-xs font-mono text-muted-foreground/60 tracking-[0.18em] uppercase mb-10">
            {t("how.eyebrow")}
          </p>

          <div className="grid sm:grid-cols-3 gap-10 sm:gap-8">
            {how.map(({ step, title, body }, i) => (
              <div
                key={step}
                className="reveal"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div
                  className="text-5xl font-bold mb-5 font-mono leading-none"
                  style={{ color: "rgba(136,109,249,0.30)" }}
                >
                  {step}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── REAL SCENARIO ─────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2
            className="reveal text-3xl sm:text-4xl lg:text-[2.75rem] font-bold mb-6 max-w-2xl leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("problem.title")}
          </h2>
          <p
            className="reveal text-muted-foreground text-base sm:text-lg mb-16 max-w-xl leading-relaxed"
            style={{ transitionDelay: "80ms" }}
          >
            {t("problem.intro")}
          </p>

          <div className="reveal grid sm:grid-cols-3 gap-4 mb-16" style={{ transitionDelay: "160ms" }}>
            <div className="border border-border/50 rounded-2xl p-6 space-y-3">
              <p className="text-xs font-mono text-muted-foreground/60 tracking-widest uppercase">{t("problem.optionAEyebrow")}</p>
              <p className="font-semibold text-foreground">{t("problem.optionATitle")}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{t("problem.optionAItem1")}</li>
                <li>{t("problem.optionAItem2")}</li>
                <li>{t("problem.optionAItem3")}</li>
              </ul>
            </div>
            <div className="border border-border/50 rounded-2xl p-6 space-y-3">
              <p className="text-xs font-mono text-muted-foreground/60 tracking-widest uppercase">{t("problem.optionBEyebrow")}</p>
              <p className="font-semibold text-foreground">{t("problem.optionBTitle")}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{t("problem.optionBItem1")}</li>
                <li>{t("problem.optionBItem2")}</li>
                <li>{t("problem.optionBItem3")}</li>
              </ul>
            </div>
            <div className="border border-border/50 rounded-2xl p-6 space-y-3">
              <p className="text-xs font-mono text-muted-foreground/60 tracking-widest uppercase">{t("problem.optionCEyebrow")}</p>
              <p className="font-semibold text-foreground">{t("problem.optionCTitle")}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{t("problem.optionCItem1")}</li>
                <li>{t("problem.optionCItem2")}</li>
                <li>{t("problem.optionCItem3")}</li>
              </ul>
            </div>
          </div>

          <p
            className="reveal text-2xl sm:text-3xl font-bold leading-snug max-w-2xl text-brand-gradient"
            style={{ transitionDelay: "240ms", fontFamily: "var(--font-display)" }}
          >
            {t("problem.betterWay")}
          </p>
        </div>
      </section>

      {/* ─────────────────────────── CORE BENEFITS ─────────────────────────── */}
      <section className="py-24 px-6 border-t border-border bg-card/20">
        <div className="max-w-4xl mx-auto">
          <p className="reveal text-xs font-mono text-muted-foreground/60 tracking-[0.18em] uppercase mb-10">
            {t("identity.eyebrow")}
          </p>
          <h2
            className="reveal text-3xl sm:text-4xl lg:text-[2.75rem] font-bold mb-6 max-w-2xl leading-tight"
            style={{ fontFamily: "var(--font-display)", transitionDelay: "80ms" }}
          >
            {t("identity.title")}
          </h2>
          <p
            className="reveal text-muted-foreground text-base sm:text-lg mb-6 max-w-xl leading-relaxed"
            style={{ transitionDelay: "160ms" }}
          >
            {t.rich("identity.p1", {
              handle: (chunks) => <span className="font-mono text-foreground">{chunks}</span>,
            })}
          </p>
          <p
            className="reveal text-muted-foreground text-base sm:text-lg mb-12 max-w-xl leading-relaxed"
            style={{ transitionDelay: "240ms" }}
          >
            {t.rich("identity.p2", {
              handle: (chunks) => <span className="font-mono text-foreground">{chunks}</span>,
            })}
          </p>

          {/* Template carousel: showcases available designs */}
          <TemplateCarousel />

          <div
            className="reveal grid sm:grid-cols-2 gap-6"
            style={{ transitionDelay: "400ms" }}
          >
            {identityFacts.map(({ title, body }) => (
              <div key={title} className="border-l-2 border-border pl-5 py-1">
                <p className="font-semibold text-foreground text-sm mb-1.5">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── OPTIONAL POWER ─────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <p className="reveal text-xs font-mono text-muted-foreground/60 tracking-[0.18em] uppercase mb-10">
            {t("earn.eyebrow")}
          </p>
          <h2
            className="reveal text-3xl sm:text-4xl lg:text-[2.75rem] font-bold mb-6 max-w-2xl leading-tight"
            style={{ fontFamily: "var(--font-display)", transitionDelay: "80ms" }}
          >
            {t("earn.title")}
          </h2>
          <p
            className="reveal text-muted-foreground text-base sm:text-lg mb-16 max-w-xl leading-relaxed"
            style={{ transitionDelay: "160ms" }}
          >
            {t("earn.intro")}
          </p>

          <div className="reveal grid sm:grid-cols-3 gap-6 mb-16" style={{ transitionDelay: "240ms" }}>
            {earnFeatures.map(({ title, body }) => (
              <div key={title} className="border border-border/50 rounded-2xl p-6 space-y-3">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <p
            className="reveal text-2xl sm:text-3xl font-bold leading-snug max-w-2xl text-brand-gradient"
            style={{ transitionDelay: "320ms", fontFamily: "var(--font-display)" }}
          >
            {t("earn.comparison")}
          </p>
        </div>
      </section>

      {/* ─────────────────────────── SECURITY ─────────────────────────── */}
      <section className="py-24 px-6 border-t border-border bg-card/20">
        <div className="max-w-4xl mx-auto">
          <p className="reveal text-xs font-mono text-muted-foreground/60 tracking-[0.18em] uppercase mb-10">
            {t("security.eyebrow")}
          </p>
          <h2
            className="reveal text-3xl sm:text-4xl lg:text-[2.75rem] font-bold mb-6 max-w-2xl leading-tight"
            style={{ fontFamily: "var(--font-display)", transitionDelay: "80ms" }}
          >
            {t("security.title")}
          </h2>
          <p
            className="reveal text-muted-foreground text-base sm:text-lg mb-10 max-w-xl leading-relaxed"
            style={{ transitionDelay: "160ms" }}
          >
            {t("security.intro")}
          </p>

          <div
            className="reveal grid sm:grid-cols-2 gap-6"
            style={{ transitionDelay: "240ms" }}
          >
            {trustSignals.map(({ title, body }) => (
              <div key={title} className="border border-border/50 rounded-2xl p-6 space-y-3">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="reveal mt-10" style={{ transitionDelay: "320ms" }}>
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("security.auditCta")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── FOR DEVELOPERS ─────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <p className="reveal text-xs font-mono text-muted-foreground/60 tracking-[0.18em] uppercase mb-10">
            {t("developers.eyebrow")}
          </p>
          <h2
            className="reveal text-3xl sm:text-4xl lg:text-[2.75rem] font-bold mb-6 max-w-2xl leading-tight"
            style={{ fontFamily: "var(--font-display)", transitionDelay: "80ms" }}
          >
            {t("developers.title")}
          </h2>
          <p
            className="reveal text-muted-foreground text-base sm:text-lg mb-6 max-w-xl leading-relaxed"
            style={{ transitionDelay: "160ms" }}
          >
            {t("developers.body")}
          </p>
          <p
            className="reveal text-muted-foreground/75 text-sm sm:text-base mb-10 max-w-xl leading-relaxed"
            style={{ transitionDelay: "200ms" }}
          >
            {t("developers.archBlurb")}
          </p>
          <div
            className="reveal flex flex-wrap items-center gap-x-8 gap-y-3"
            style={{ transitionDelay: "240ms" }}
          >
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("developers.cta")} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/architecture"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("developers.archCta")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── BLOG ─────────────────────────── */}
      {publishedHighlights.length > 0 && (
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <p className="reveal text-xs font-mono text-muted-foreground/60 tracking-[0.18em] uppercase mb-10">
            {t("blog.eyebrow")}
          </p>
          <h2
            className="reveal text-3xl sm:text-4xl lg:text-[2.75rem] font-bold mb-6 max-w-2xl leading-tight"
            style={{ fontFamily: "var(--font-display)", transitionDelay: "80ms" }}
          >
            {t("blog.title")}
          </h2>
          <p
            className="reveal text-muted-foreground text-base sm:text-lg mb-12 max-w-xl leading-relaxed"
            style={{ transitionDelay: "160ms" }}
          >
            {t("blog.intro")}
          </p>

          <div className="reveal grid sm:grid-cols-3 gap-6" style={{ transitionDelay: "240ms" }}>
            {publishedHighlights.map(({ title, description, slug }) => (
              <Link
                key={slug}
                href={`/blog/${slug}`}
                className="group border border-border/50 rounded-2xl p-6 space-y-3 hover:border-primary/40 transition-colors"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium pt-1">
                  {t("blog.readCta")} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            ))}
          </div>

          <div className="reveal mt-10" style={{ transitionDelay: "320ms" }}>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("blog.allArticles")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* ─────────────────────────── CTA ─────────────────────────── */}
      <section className="py-24 px-6 border-t border-border bg-card/20">
        <div className="max-w-xl mx-auto text-center">
          <h2
            className="reveal text-3xl sm:text-4xl font-bold mb-4 leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("cta.title")}
          </h2>
          <p
            className="reveal text-muted-foreground mb-3 text-base sm:text-lg leading-relaxed"
            style={{ transitionDelay: "80ms" }}
          >
            {t("cta.body")}
          </p>
          <p
            className="reveal text-muted-foreground/60 mb-10 text-sm"
            style={{ transitionDelay: "120ms" }}
          >
            {t("cta.disclaimer")}
          </p>
          <div className="reveal" style={{ transitionDelay: "180ms" }}>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-[#0d0d2b] h-11 px-8 text-sm transition-transform hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(90deg, #45e6d1 0%, #41c6e9 40%, #7c5ce6 80%, #7f3db9 100%)",
                boxShadow: "0 0 28px rgba(136,109,249,0.38)",
              }}
            >
              {t("cta.button")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

/* ─────────────────────────── TEMPLATE CAROUSEL ─────────────────────────── */

const TEMPLATE_BG: Record<string, string> = {
  classic: "#0d0d2b",
  neon: "#060618",
  glass: "#0A0E24",
  aurora: "#020614",
  cyber: "#050510",
  vapor: "#060618",
  matrix: "#020808",
  bloom: "#050410",
}

function getShowcaseTemplates() {
  return getAllTemplates().slice(0, 8)
}

const noop = () => {}
const PREVIEW_PROPS: TemplateProps = {
  handle: "lucky-mountain",
  bio: "crypto, built for humans",
  avatarUrl: null,
  createdAt: "March 2026",
  addresses: [
    { chain: "bitcoin", name: "Bitcoin", symbol: "BTC", address: "bc1qz3yaratxc9z6wz2pj2k97nzl00l4cucpvcquq9", derivationPath: "m/84'/0'/0'/0/0", logo: "/logos/bitcoin.svg" },
    { chain: "ethereum", name: "Ethereum", symbol: "ETH", address: "0x874a40B1857B006d46b80c9e6badCEF3BA3B705C", derivationPath: "m/44'/60'/0'/0/0", logo: "/logos/ethereum.svg" },
    { chain: "solana", name: "Solana", symbol: "SOL", address: "9rhN3eug2LbqZKCtbkGRKjRq9BVa4Y5VE4Puf2p4HCRk", derivationPath: "m/44'/501'/0'/0'", logo: "/logos/solana.svg" },
  ],
  isOwnProfile: false,
  isLoggedIn: false,
  // These previews are decorative cards in the landing-page carousel,
  // not real profile pages. Mark them as such so templates downgrade
  // their handle heading from <h1> to a non-heading element (otherwise
  // the landing page ends up with one <h1> per showcased template,
  // which SEO checkers flag as "more than one h1 tag").
  isPreview: true,
  onAvatarUpload: noop,
  onAvatarDelete: noop,
  avatarUploading: false,
  onBioEdit: noop,
  onSend: noop,
  tipOverlay: (
    <div className="absolute -bottom-1 -right-1 z-10 w-7 h-7 rounded-full bg-pink-500/90 flex items-center justify-center shadow-lg shadow-pink-500/25">
      <Heart className="w-3.5 h-3.5 text-white fill-white" />
    </div>
  ),
}

function TemplateCarousel() {
  const t = useTranslations("landing.template")
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex(idx)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  const scrollTo = (index: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" })
  }

  return (
    <div
      className="reveal mb-14 w-full max-w-sm"
      style={{ transitionDelay: "320ms" }}
    >
      {/* Carousel viewport */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {getShowcaseTemplates().map((tmpl) => {
          const TemplateComponent = tmpl.component
          return (
            <div key={tmpl.id} className="snap-center shrink-0 w-full px-1">
              <div
                className="relative rounded-2xl border border-border/60 overflow-hidden"
                style={{ backgroundColor: TEMPLATE_BG[tmpl.id] ?? "#0d0d2b" }}
              >
                {/* Scaled-down live template preview */}
                <div className="relative h-[360px] sm:h-[400px] overflow-hidden pointer-events-none">
                  <div
                    className={`origin-top-left template-preview-fill${
                      tmpl.light ? "" : tmpl.themed ? ` themed-${tmpl.id}` : " palette-default"
                    }`}
                    style={{
                      transform: "scale(0.48)",
                      width: "208%",
                      height: "840px",
                    }}
                  >
                    <TemplateComponent {...PREVIEW_PROPS} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {getShowcaseTemplates().map((tmpl, i) => (
          <button
            key={tmpl.id}
            onClick={() => scrollTo(i)}
            aria-label={t("viewTemplateAria", { name: tmpl.name })}
            className={`w-2 h-2 rounded-full transition-all ${
              i === activeIndex ? "bg-primary scale-125" : "bg-border hover:bg-muted-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── CONTENT ─────────────────────────── */

// Blog highlights are hardcoded English metadata - the actual blog
// posts live in PostgreSQL and still serve English only. Translated
// blog bodies are out of scope for v1.2.0 (would need a schema change
// to add `title_de`, `description_de`, `sections_de` columns).
// The landing page carousel falls back to these English titles on
// every locale until the DB migration lands.
const BLOG_HIGHLIGHTS = [
  {
    title: "Ready to Launch",
    description: "What it feels like when the thing you built actually works.",
    slug: "ready-to-launch",
    publishedAt: "2026-04-02",
  },
  {
    title: "Why nimimo Exists",
    description: "The problem with crypto isn't crypto. It's the onramp.",
    slug: "why-nimimo-exists",
    publishedAt: "2026-03-10",
  },
  {
    title: "Device-Bound Encryption",
    description: "Your keys live on your device. Here's exactly how.",
    slug: "how-device-bound-encryption-works",
    publishedAt: "2026-03-17",
  },
  {
    title: "Recovery Cards, Explained",
    description: "How nimimo makes backup feel like something you'd actually do.",
    slug: "recovery-cards-explained",
    publishedAt: "2026-03-24",
  },
]
