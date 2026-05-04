import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Footer } from "@/components/footer"
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/lib/og-metadata"
import { SITE_URL } from "@/lib/site-config"
import { JsonLd } from "@/components/json-ld"
import { Separator } from "@/components/ui/separator"
import {
  getArticleBySlug,
  getAdjacentArticles,
  getAllArticles,
  formatDate,
  estimateReadingTime,
} from "../lib"
import { ArticleRenderer } from "../components"

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const articles = await getAllArticles()
    return articles.map((article) => ({ slug: article.slug }))
  } catch {
    // Table may not exist yet during first build
    return []
  }
}

export const dynamicParams = true
export const revalidate = 60

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article) {
    return { title: "Article Not Found" }
  }

  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: `${article.title} | nimimo`,
      description: article.description,
      url: `${SITE_URL}/blog/${article.slug}`,
      type: "article",
      publishedTime: article.publishedAt,
      authors: ["nimimo"],
      tags: article.tags,
      images: DEFAULT_OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: DEFAULT_TWITTER_IMAGES,
    },
    alternates: {
      canonical: `${SITE_URL}/blog/${article.slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const { prev, next } = await getAdjacentArticles(article.id)

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            {/* Back link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
            >
              <ArrowLeft className="w-4 h-4" />
              All articles
            </Link>

            {/* Article header */}
            <header className="space-y-4 mb-12">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <time dateTime={article.publishedAt}>
                  {formatDate(article.publishedAt)}
                </time>
                <span className="text-border">·</span>
                <span>{estimateReadingTime(article.sections)}</span>
              </div>

              <h1
                className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-foreground leading-[1.15] tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {article.title}
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed">
                {article.subtitle}
              </p>

              {article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            <Separator className="mb-12" />

            {/* Article body */}
            <article>
              <ArticleRenderer sections={article.sections} />
            </article>

            {/* CTA */}
            {article.cta && (
              <div className="mt-16 mb-12 text-center py-12 px-6 rounded-2xl border border-border bg-card/40">
                <p className="text-lg text-foreground font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                  Ready to try it?
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  No seed phrases. No KYC. Just an email.
                </p>
                <Link
                  href={article.cta.href}
                  className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-[#0d0d2b] h-11 px-8 text-sm transition-transform hover:scale-105 active:scale-95"
                  style={{
                    background: "linear-gradient(90deg, #45e6d1 0%, #41c6e9 40%, #7c5ce6 80%, #7f3db9 100%)",
                    boxShadow: "0 0 28px rgba(136,109,249,0.38)",
                  }}
                >
                  {article.cta.text} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            <Separator className="my-12" />

            {/* Navigation */}
            <nav className="flex items-stretch gap-4">
              {prev ? (
                <Link
                  href={`/blog/${prev.slug}`}
                  className="flex-1 group p-4 rounded-lg border border-border hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Previous
                  </div>
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {prev.title}
                  </div>
                </Link>
              ) : (
                <div className="flex-1" />
              )}
              {next ? (
                <Link
                  href={`/blog/${next.slug}`}
                  className="flex-1 group p-4 rounded-lg border border-border hover:border-primary/40 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground mb-1">
                    Next
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {next.title}
                  </div>
                </Link>
              ) : (
                <div className="flex-1" />
              )}
            </nav>
          </div>
        </div>
      </main>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          description: article.description,
          datePublished: article.publishedAt,
          url: `${SITE_URL}/blog/${article.slug}`,
          author: {
            "@type": "Organization",
            name: "nimimo",
            url: SITE_URL,
          },
          publisher: {
            "@type": "Organization",
            name: "nimimo",
            url: SITE_URL,
          },
          isPartOf: {
            "@type": "Blog",
            name: "nimimo Blog",
            url: `${SITE_URL}/blog`,
          },
        }}
      />

      <Footer />
    </div>
  )
}
