import { Loader2 } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"

export default async function Loading() {
  const t = await getTranslations("auth.loading")
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardContent className="flex flex-col items-center gap-6 p-8 md:p-12">
          <div className="rounded-full bg-primary/10 p-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{t("title")}</h1>
            <p className="text-sm text-muted-foreground md:text-base">{t("body")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
