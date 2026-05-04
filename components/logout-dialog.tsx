"use client"

import { logger } from "@/lib/logger"
import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useOwnership } from "@/components/ownership-provider"

const log = logger("auth")

interface LogoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accessId?: string
  currentOwnershipId?: string
}

export function LogoutDialog({ open, onOpenChange, accessId, currentOwnershipId }: LogoutDialogProps) {
  const t = useTranslations("logoutDialog")
  const { getManager } = useOwnership()
  const [removeOption, setRemoveOption] = useState<"keep" | "this" | "all">("keep")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [linkedOwnershipCount, setLinkedOwnershipCount] = useState(0)

  useEffect(() => {
    if (open && accessId) {
      const fetchLinkedCount = async () => {
        const manager = await getManager()
        const binding = await manager.db.getAccessBinding(accessId)
        setLinkedOwnershipCount(binding?.ownership_ids.length || 0)
      }
      fetchLinkedCount()
    }
    // Reset to default when dialog opens
    setRemoveOption("keep")
  }, [open, accessId, getManager])

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      if (removeOption !== "keep" && accessId && linkedOwnershipCount > 0) {
        const manager = await getManager()
        const binding = await manager.db.getAccessBinding(accessId)

        if (binding && binding.ownership_ids.length > 0) {
          if (removeOption === "this" && currentOwnershipId) {
            await manager.db.deleteOwnershipAndUpdateBinding([currentOwnershipId], accessId)
          } else if (removeOption === "all") {
            await manager.db.deleteOwnershipAndUpdateBinding(binding.ownership_ids, accessId)
            const { clearDeviceKeys } = await import("@/lib/ownership/crypto")
            await clearDeviceKeys()
          }
        }
      }

      onOpenChange(false)

      await signOut({ redirect: false })
      window.location.href = "/auth/login"
    } catch (error) {
      log.error("Error during logout", error)
      setIsLoggingOut(false)
    }
  }

  const hasMultipleOwnerships = linkedOwnershipCount > 1
  const hasAnyOwnerships = linkedOwnershipCount > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasAnyOwnerships ? t("bodyWithOwnerships") : t("bodyNoOwnerships")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasAnyOwnerships && (
          <RadioGroup value={removeOption} onValueChange={(value) => setRemoveOption(value as "keep" | "this" | "all")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="keep" id="keep" />
              <Label htmlFor="keep" className="font-normal cursor-pointer">
                {t("optionKeep")}
              </Label>
            </div>

            {hasMultipleOwnerships ? (
              <>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="this" id="remove-this" />
                  <Label htmlFor="remove-this" className="font-normal cursor-pointer">
                    {t("optionRemoveThis")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="remove-all" />
                  <Label htmlFor="remove-all" className="font-normal cursor-pointer">
                    {t("optionRemoveAll")}
                  </Label>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="remove-all" />
                <Label htmlFor="remove-all" className="font-normal cursor-pointer">
                  {t("optionRemoveSingle")}
                </Label>
              </div>
            )}
          </RadioGroup>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoggingOut}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? t("loggingOut") : t("logout")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
