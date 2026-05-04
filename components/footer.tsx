import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { ContactLink } from "@/components/contact-link"
import { FooterLanguageSwitcher } from "@/components/language-switcher"

export function Footer() {
  const currentYear = new Date().getFullYear()
  const t = useTranslations("footer")

  return (
    <footer className="border-t border-border/30">
      <div className="container mx-auto px-4 py-4 flex flex-col items-center gap-2">
        <span
          className="text-xs font-semibold tracking-tight text-foreground/60"
          style={{ fontFamily: "var(--font-display)" }}
        >
          nimimo
        </span>
        <div className="flex items-center flex-wrap justify-center gap-4 text-[10px] text-muted-foreground/40">
          <Link href="/architecture" className="hover:text-muted-foreground/60 transition-colors">{t("architecture")}</Link>
          <Link href="/audit" className="hover:text-muted-foreground/60 transition-colors">{t("security")}</Link>
          <Link href="/blog" className="hover:text-muted-foreground/60 transition-colors">{t("blog")}</Link>
          <Link href="/docs" className="hover:text-muted-foreground/60 transition-colors">{t("docs")}</Link>
          <Link href="/terms" className="hover:text-muted-foreground/60 transition-colors">{t("terms")}</Link>
          <Link href="/privacy" className="hover:text-muted-foreground/60 transition-colors">{t("privacy")}</Link>
          <ContactLink className="hover:text-muted-foreground/60 transition-colors">{t("contact")}</ContactLink>
        </div>
        <FooterLanguageSwitcher />
        <p className="text-center text-[10px] text-muted-foreground/40">© {currentYear} nimimo. {t("rights")}</p>
      </div>
    </footer>
  )
}
