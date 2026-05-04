import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Footer } from "@/components/footer"
import { JsonLd } from "@/components/json-ld"
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/lib/og-metadata"
import { SITE_URL } from "@/lib/site-config"
import { getAllArticles, formatDate, estimateReadingTime } from "./lib"

export const metadata: Metadata = {
  title: "Blog",
  description:
    "How nimimo works: a name instead of a wallet address, BIP-39 key generation, AES-256 device encryption, multi-chain Bitcoin Ethereum Solana, recovery cards, and self-custody by default.",
  keywords: [
    "non-custodial wallet",
    "crypto identity",
    "self-sovereign identity",
    "Bitcoin wallet no KYC",
    "Ethereum wallet without seed phrase",
    "Solana wallet",
    "human-readable crypto address",
    "crypto payment link",
    "BIP-39 wallet",
    "device-bound encryption",
    "AES-256-GCM",
    "crypto recovery card",
    "receive Bitcoin with a link",
    "receive Ethereum with a link",
    "receive Solana with a link",
    "crypto without KYC",
    "non-custodial identity",
    "web3 identity",
    "crypto for beginners",
    "send crypto to a name",
  ],
  openGraph: {
    title: "Blog | nimimo",
    description:
      "A name instead of a wallet address. Receive Bitcoin, Ethereum, and Solana with a username. Self-custody by default.",
    url: `${SITE_URL}/blog`,
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | nimimo",
    description:
      "A name instead of a wallet address. Receive Bitcoin, Ethereum, and Solana with a username. Self-custody by default.",
    images: DEFAULT_TWITTER_IMAGES,
  },
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
}

export default async function BlogIndexPage() {
  const articles = await getAllArticles()

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto space-y-10">
            {/* Header */}
            <div className="text-center space-y-3">
              <h1
                className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Blog
              </h1>
              <p className="text-base text-muted-foreground text-balance leading-relaxed max-w-2xl mx-auto">
                How nimimo works, why it exists, and what we're building next.
              </p>
            </div>

            {/* Articles */}
            <div className="space-y-0 divide-y divide-border">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/blog/${article.slug}`}
                  className="block group py-10 first:pt-0 last:pb-0"
                >
                  <article className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <time dateTime={article.publishedAt}>
                        {formatDate(article.publishedAt)}
                      </time>
                      <span className="text-border">·</span>
                      <span>
                        {estimateReadingTime(article.sections)}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-semibold text-foreground group-hover:text-primary transition-colors">
                      {article.title}
                    </h2>

                    <p className="text-base text-muted-foreground leading-relaxed">
                      {article.subtitle}
                    </p>

                    <div className="flex items-center gap-2 text-sm text-primary font-medium pt-1">
                      Read article
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {articles.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No articles yet. Check back soon.
              </p>
            )}
          </div>
        </div>
      </main>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "nimimo Blog",
          description:
            "Updates, technical deep dives, and the thinking behind nimimo.",
          url: `${SITE_URL}/blog`,
          publisher: {
            "@type": "Organization",
            name: "nimimo",
            url: SITE_URL,
          },
          blogPost: articles.map((a) => ({
            "@type": "BlogPosting",
            headline: a.title,
            description: a.description,
            datePublished: a.publishedAt,
            url: `${SITE_URL}/blog/${a.slug}`,
            author: { "@type": "Organization", name: "nimimo" },
          })),
        }}
      />

      <Footer />
    </div>
  )
}
