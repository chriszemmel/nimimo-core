import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default async function NotFound() {
  const t = await getTranslations("profile")
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">{t("identityNotFoundTitle")}</h1>
            <p className="text-muted-foreground">{t("identityNotFoundBody")}</p>
          </div>
          <Button asChild className="w-full">
            <Link href="/">{t("goToHomepage")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
