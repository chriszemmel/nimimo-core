"use client"

import { useSession } from "next-auth/react"
import { AppHeader } from "./app-header"
import { useOwnership } from "@/components/ownership-provider"
import { usePathname } from "next/navigation"

export function AppHeaderWrapper() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { ownershipId, switchOwnership, status: ownershipStatus } = useOwnership()

  const handleOwnershipSwitch = async (newOwnershipId: string) => {
    await switchOwnership(newOwnershipId)
  }

  if (pathname === "/auth/verify" || pathname === "/auth/callback") {
    return null
  }

  const isSessionLoading = status === "loading"
  const isOwnershipLoading = status === "authenticated" && ownershipStatus === "loading"

  return (
    <AppHeader
      isAuthenticated={status === "authenticated"}
      ownershipId={ownershipId}
      accessId={session?.user?.email || undefined}
      userEmail={session?.user?.email || undefined}
      onOwnershipSwitch={handleOwnershipSwitch}
      isSessionLoading={isSessionLoading}
      isOwnershipLoading={isOwnershipLoading}
    />
  )
}
