"use client"

import { useState } from "react"
import Image from "next/image"
import { User } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OwnershipSwitcher } from "@/components/ownership-switcher"
import { LogoutDialog } from "@/components/logout-dialog"

interface AppHeaderProps {
  isAuthenticated: boolean
  ownershipId?: string | null
  accessId?: string
  userEmail?: string
  onOwnershipSwitch?: (newOwnershipId: string) => void
  isSessionLoading?: boolean
  isOwnershipLoading?: boolean
}

export function AppHeader({
  isAuthenticated,
  ownershipId,
  accessId,
  userEmail,
  onOwnershipSwitch,
  isSessionLoading = false,
  isOwnershipLoading = false,
}: AppHeaderProps) {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const t = useTranslations("nav")

  return (
    <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="nimimo Logo" width={36} height={36} className="w-9 h-9" />
          <span className="text-xl font-semibold tracking-tight text-foreground" style={{fontFamily: "var(--font-display)"}}>nimimo</span>
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          {!isSessionLoading && isAuthenticated && !isOwnershipLoading && ownershipId && accessId && onOwnershipSwitch && (
            <OwnershipSwitcher currentOwnershipId={ownershipId} accessId={accessId} onSwitch={onOwnershipSwitch} />
          )}
          {isSessionLoading ? null : isAuthenticated ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-9 h-9 hover:bg-muted/50 border border-border"
                  >
                    <User className="h-5 w-5" />
                    <span className="sr-only">{t("userMenu")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="w-56">
                  <div className="px-2 py-1.5 text-sm font-medium">{userEmail || "User"}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/identity">{t("identity")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/wallet">{t("wallet")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/settings">{t("settings")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowLogoutDialog(true)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          ) : (
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-full px-4 h-8 text-xs font-semibold text-white relative overflow-hidden transition-transform hover:scale-105 active:scale-95 access-btn-gradient"
            >
              <span className="relative z-10">{t("access")}</span>
            </Link>
          )}
        </div>
      </div>

      <LogoutDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        accessId={accessId}
        currentOwnershipId={ownershipId || undefined}
      />
    </header>
  )
}
