import type { Metadata } from "next"
import { Share, Smartphone, Monitor, AlertTriangle, ArrowRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { Card } from "@/components/ui/card"
import { SITE_URL } from "@/lib/site-config"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "install" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `${SITE_URL}/install`,
    },
  }
}

export default async function InstallPage() {
  const t = await getTranslations("install")

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4">
      <main className="w-full max-w-2xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">{t("pageDescription")}</p>
        </header>

        {/* Must-read first: recovery file warning. The installed shortcut
            may land on a fresh IndexedDB (guaranteed on iOS, sometimes on
            desktop), which means any identity set up in the browser is
            invisible to the installed app until it's restored from the
            recovery file. Users who install without a recovery file ready
            will lock themselves out of their in-browser identity. */}
        <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {t("warning.title")}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t.rich("warning.body", {
                  em: (chunks) => <em>{chunks}</em>,
                })}
              </p>
              <Link
                href="/recovery"
                className="inline-flex items-center gap-1 text-sm font-semibold text-amber-900 dark:text-amber-100 hover:underline"
              >
                {t("warning.cta")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-500" />
            {t("iphone.heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("iphone.intro")}</p>
          <ol className="space-y-3 text-sm list-none">
            {(["step1", "step2", "step3", "step4"] as const).map((stepKey, i) => (
              <li key={stepKey} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">
                  {t.rich(`iphone.${stepKey}`, {
                    code: (chunks) => <span className="text-foreground font-mono">{chunks}</span>,
                    highlight: (chunks) => <span className="text-foreground font-medium">{chunks}</span>,
                    icon: () => <Share className="inline h-4 w-4 mx-0.5 -mt-0.5" />,
                  })}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-500" />
            {t("desktop.heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("desktop.intro")}</p>
          <ol className="space-y-3 text-sm list-none">
            {(["step1", "step2", "step3", "step4"] as const).map((stepKey, i) => (
              <li key={stepKey} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">
                  {t.rich(`desktop.${stepKey}`, {
                    code: (chunks) => <span className="text-foreground font-mono">{chunks}</span>,
                    highlight: (chunks) => <span className="text-foreground font-medium">{chunks}</span>,
                  })}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">{t("after.heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("after.body")}</p>

          <Link
            href="/restore"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#3b82f6" }}
          >
            {t("after.cta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  )
}
