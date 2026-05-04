"use client"

import { logger } from "@/lib/logger"
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { OwnershipManager } from "@/lib/ownership/manager"
import { apiFetch } from "@/lib/api-fetch"
import type { OwnershipRecord } from "@/lib/ownership/indexeddb"
import type { DerivedAddress } from "@/lib/ownership/v1/derive"
import { getChainConfig } from "@/lib/ownership/v1/chains"
import { useToast } from "@/hooks/use-toast"

const log = logger("ownership")

// ── Types ────────────────────────────────────────────────────────────────────

type OwnershipStatus = "loading" | "ready" | "prompt" | "error"

interface OwnershipState {
  status: OwnershipStatus
  ownershipId: string | null
  identity: string | null
  recoveryState: "none" | "created" | "verified"
  ownershipCreatedAt: number
  derivedAddresses: DerivedAddress[]
  unlinkedOwnerships: OwnershipRecord[]
  localOwnerships: OwnershipRecord[]
  isNewUser: boolean | null
}

interface OwnershipContextType extends OwnershipState {
  // Actions
  switchOwnership: (ownershipId: string) => Promise<void>
  createOwnership: () => Promise<string>
  bindOwnership: (ownershipId: string) => Promise<void>
  bindMultipleOwnerships: (ownershipIds: string[]) => Promise<void>
  refreshOwnership: () => Promise<void>
  refreshRecoveryState: () => Promise<void>
  refreshUnlinkedOwnerships: () => Promise<void>
  refreshAddresses: (ownershipId?: string) => Promise<void>
  getMnemonic: (ownershipId: string) => Promise<string>
  deleteUnlinkedOwnership: (ownershipId: string) => Promise<void>
  handleOwnershipRestored: () => void
  dismissUnlinkedAlert: () => void
  showUnlinkedAlert: boolean
  // Escape hatch for complex flows (restore, logout)
  getManager: () => Promise<OwnershipManager>
}

const OwnershipContext = createContext<OwnershipContextType | undefined>(undefined)

// ── Provider ─────────────────────────────────────────────────────────────────

export function OwnershipProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession()
  const { toast } = useToast()
  const managerRef = useRef<OwnershipManager | null>(null)
  const initStartedRef = useRef(false)
  const emailRef = useRef<string | null>(null)

  if (session?.user?.email && session.user.email !== emailRef.current) {
    emailRef.current = session.user.email
  }

  const [state, setState] = useState<OwnershipState>(() => ({
    status: "loading",
    ownershipId: null,
    identity: null,
    recoveryState: "none",
    ownershipCreatedAt: Date.now(),
    derivedAddresses: [],
    unlinkedOwnerships: [],
    localOwnerships: [],
    isNewUser: null,
  }))
  const [showUnlinkedAlert, setShowUnlinkedAlert] = useState(false)

  // ── Manager singleton ──────────────────────────────────────────────────

  const getManager = useCallback(async (): Promise<OwnershipManager> => {
    if (!managerRef.current) {
      managerRef.current = new OwnershipManager()
      await managerRef.current.initialize()
    }
    return managerRef.current
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────

  const loadOwnershipDetails = useCallback(async (manager: OwnershipManager, ownershipId: string) => {
    const [handle, record] = await Promise.all([
      manager.getIdentity(ownershipId),
      manager.db.getOwnership(ownershipId),
    ])

    let identity = handle
    if (!identity && record) {
      try {
        identity = await manager.assignIdentity(ownershipId)
      } catch (error) {
        log.error("Failed to auto-reassign identity", error)
      }
    }

    return {
      identity,
      recoveryState: (record?.recovery?.state || "none") as "none" | "created" | "verified",
      ownershipCreatedAt: record?.createdAt || Date.now(),
    }
  }, [])

  const computeUnlinkedOwnerships = useCallback(async (manager: OwnershipManager) => {
    const [allOwnerships, allBindings] = await Promise.all([
      manager.db.getAllOwnerships(),
      manager.db.getAllAccessBindings(),
    ])

    const boundIds = new Set<string>()
    allBindings.forEach((b) => b.ownership_ids.forEach((id) => boundIds.add(id)))

    return allOwnerships.filter((o) => !boundIds.has(o.ownership_id))
  }, [])

  const fetchOrDeriveAddresses = useCallback(async (ownershipId: string): Promise<DerivedAddress[]> => {
    try {
      const response = await apiFetch(`/api/addresses/get?ownership_id=${ownershipId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.addresses && data.addresses.length > 0) {
          const uniqueMap = new Map<string, DerivedAddress>()
          data.addresses.forEach((addr: { chain: string; address: string }) => {
            if (!uniqueMap.has(addr.chain)) {
              const config = getChainConfig(addr.chain)
              uniqueMap.set(addr.chain, {
                chain: addr.chain,
                address: addr.address,
                name: config?.name || addr.chain,
                logo: config?.logo || "",
                symbol: config?.symbol || "",
                derivationPath: config?.derivationPath || "",
              })
            }
          })
          return Array.from(uniqueMap.values())
        }
      }
    } catch {
      // Fall through to derivation
    }

    try {
      const manager = await getManager()
      const ownership = await manager.db.getOwnership(ownershipId)
      if (!ownership) return []

      const { decryptSeed } = await import("@/lib/ownership/crypto")
      const mnemonic = await decryptSeed(ownership.encryptedSeed, ownership.iv, ownership.ownership_id)

      const { deriveV1Addresses } = await import("@/lib/ownership/v1/derive")
      const result = await deriveV1Addresses(mnemonic)

      if (result.success) {
        apiFetch("/api/addresses/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownership_id: ownershipId,
            ownership_version: ownership.version,
            addresses: result.addresses.map((a) => ({ chain: a.chain, address: a.address })),
          }),
        }).catch((err) => log.error("Failed to store addresses", err))

        return result.addresses
      }
    } catch (error) {
      log.error("Error deriving addresses", error)
    }

    return []
  }, [getManager])

  // ── Initialization ─────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !emailRef.current) return
    if (initStartedRef.current) return
    initStartedRef.current = true

    const accessId = emailRef.current

    async function initialize() {
      try {
        const userCheckPromise = apiFetch("/api/user/check-returning")
          .then((res) => (res.ok ? res.json() : { isNewUser: false }))
          .then((data) => data.isNewUser as boolean)
          .catch(() => false)

        const [isNewUser, manager] = await Promise.all([userCheckPromise, getManager()])

        const [resolution, unlinked] = await Promise.all([
          manager.resolveOwnership(accessId),
          computeUnlinkedOwnerships(manager),
        ])

        if (resolution.cryptoUpgrade) {
          toast({
            title: "Security upgrade applied",
            description: "Your encryption has been upgraded to the latest standard. Please create a new identity to continue.",
          })
        }

        if (resolution.hasOwnership && resolution.ownership_id) {
          const record = await manager.db.getOwnership(resolution.ownership_id)

          setState({
            status: "ready",
            ownershipId: resolution.ownership_id,
            identity: null,
            recoveryState: (record?.recovery?.state || "none") as "none" | "created" | "verified",
            ownershipCreatedAt: record?.createdAt || Date.now(),
            derivedAddresses: [],
            unlinkedOwnerships: unlinked,
            localOwnerships: [],
            isNewUser,
          })
          if (unlinked.length > 0) setShowUnlinkedAlert(true)

          loadOwnershipDetails(manager, resolution.ownership_id)
            .then(async (details) => {
              const addresses = await fetchOrDeriveAddresses(resolution.ownership_id!)
              setState((prev) => ({
                ...prev,
                identity: details.identity,
                derivedAddresses: addresses,
              }))
            }).catch((error) => {
              log.error("Background ownership details load failed", error)
            })
        } else if (isNewUser) {
          // `initial: true` tells the server this call is a first-identity
          // attempt. If a concurrent tab / strict-mode remount / retry lost
          // the CAS, the server reconciles to the winner's identity instead
          // of creating a duplicate.
          const newOwnershipId = await manager.createOwnership(accessId, { initial: true })

          const record = await manager.db.getOwnership(newOwnershipId)

          setState({
            status: "ready",
            ownershipId: newOwnershipId,
            identity: null,
            recoveryState: (record?.recovery?.state || "none") as "none" | "created" | "verified",
            ownershipCreatedAt: record?.createdAt || Date.now(),
            derivedAddresses: [],
            unlinkedOwnerships: unlinked,
            localOwnerships: [],
            isNewUser,
          })
          if (unlinked.length > 0) setShowUnlinkedAlert(true)

          loadOwnershipDetails(manager, newOwnershipId)
            .then(async (details) => {
              const addresses = await fetchOrDeriveAddresses(newOwnershipId)
              setState((prev) => ({
                ...prev,
                identity: details.identity,
                derivedAddresses: addresses,
              }))
            }).catch((error) => {
              log.error("Background ownership details load failed", error)
            })
        } else {
          setState({
            status: "prompt",
            ownershipId: null,
            identity: null,
            recoveryState: "none",
            ownershipCreatedAt: Date.now(),
            derivedAddresses: [],
            unlinkedOwnerships: unlinked,
            localOwnerships: resolution.localOwnerships,
            isNewUser,
          })
          if (unlinked.length > 0) setShowUnlinkedAlert(true)
        }
      } catch (error) {
        log.error("Initialization error", error)
        setState((prev) => ({ ...prev, status: "error" }))
      }
    }

    initialize()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- emailRef is stable; initStartedRef guards re-entry
  }, [sessionStatus, getManager, loadOwnershipDetails, computeUnlinkedOwnerships, fetchOrDeriveAddresses])

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      managerRef.current = null
      initStartedRef.current = false
      setState({
        status: "loading",
        ownershipId: null,
        identity: null,
        recoveryState: "none",
        ownershipCreatedAt: Date.now(),
        derivedAddresses: [],
        unlinkedOwnerships: [],
        localOwnerships: [],
        isNewUser: null,
      })
      setShowUnlinkedAlert(false)
    }
  }, [sessionStatus])

  // ── Actions ────────────────────────────────────────────────────────────

  const switchOwnership = useCallback(async (ownershipId: string) => {
    if (!session?.user?.email) return

    const manager = await getManager()
    await manager.switchOwnership(session.user.email, ownershipId)

    const details = await loadOwnershipDetails(manager, ownershipId)
    const addresses = await fetchOrDeriveAddresses(ownershipId)

    setState((prev) => ({
      ...prev,
      status: "ready",
      ownershipId,
      identity: details.identity,
      recoveryState: details.recoveryState,
      ownershipCreatedAt: details.ownershipCreatedAt,
      derivedAddresses: addresses,
    }))

  }, [session?.user?.email, getManager, loadOwnershipDetails, fetchOrDeriveAddresses])

  const createOwnership = useCallback(async (): Promise<string> => {
    if (!session?.user?.email) throw new Error("Not authenticated")

    const manager = await getManager()
    const newOwnershipId = await manager.createOwnership(session.user.email)

    const details = await loadOwnershipDetails(manager, newOwnershipId)
    const addresses = await fetchOrDeriveAddresses(newOwnershipId)
    const unlinked = await computeUnlinkedOwnerships(manager)

    setState((prev) => ({
      ...prev,
      status: "ready",
      ownershipId: newOwnershipId,
      identity: details.identity,
      recoveryState: details.recoveryState,
      ownershipCreatedAt: details.ownershipCreatedAt,
      derivedAddresses: addresses,
      unlinkedOwnerships: unlinked,
    }))

    return newOwnershipId
  }, [session?.user?.email, getManager, loadOwnershipDetails, fetchOrDeriveAddresses, computeUnlinkedOwnerships])

  const bindOwnership = useCallback(async (ownershipId: string) => {
    if (!session?.user?.email) return

    const manager = await getManager()
    await manager.bindExistingOwnership(session.user.email, ownershipId)
    await manager.switchOwnership(session.user.email, ownershipId)

    try {
      await manager.assignIdentity(ownershipId)
    } catch (error) {
      log.error("Failed to assign identity during bind", error)
    }

    let details = { identity: null as string | null, recoveryState: "none" as "none" | "created" | "verified", ownershipCreatedAt: Date.now() }
    let addresses: DerivedAddress[] = []
    let unlinked: OwnershipRecord[] = []

    try {
      details = await loadOwnershipDetails(manager, ownershipId)
    } catch (error) {
      log.error("Failed to load ownership details after binding", error)
    }

    try {
      addresses = await fetchOrDeriveAddresses(ownershipId)
    } catch (error) {
      log.error("Failed to fetch addresses after binding", error)
    }

    try {
      unlinked = await computeUnlinkedOwnerships(manager)
    } catch (error) {
      log.error("Failed to compute unlinked ownerships after binding", error)
    }

    setState((prev) => ({
      ...prev,
      status: "ready",
      ownershipId,
      identity: details.identity,
      recoveryState: details.recoveryState,
      ownershipCreatedAt: details.ownershipCreatedAt,
      derivedAddresses: addresses,
      unlinkedOwnerships: unlinked,
    }))
    if (unlinked.length === 0) setShowUnlinkedAlert(false)
  }, [session?.user?.email, getManager, loadOwnershipDetails, fetchOrDeriveAddresses, computeUnlinkedOwnerships])

  const bindMultipleOwnerships = useCallback(async (ownershipIds: string[]) => {
    if (!session?.user?.email || ownershipIds.length === 0) return

    const manager = await getManager()
    await manager.bindMultipleOwnerships(session.user.email, ownershipIds)

    for (const id of ownershipIds) {
      try {
        await manager.assignIdentity(id)
      } catch (error) {
        log.error("Failed to assign identity during multi-bind", error)
      }
    }

    let details = { identity: null as string | null, recoveryState: "none" as "none" | "created" | "verified", ownershipCreatedAt: Date.now() }
    let addresses: DerivedAddress[] = []
    let unlinked: OwnershipRecord[] = []

    try {
      details = await loadOwnershipDetails(manager, ownershipIds[0])
    } catch (error) {
      log.error("Failed to load ownership details after binding", error)
    }

    try {
      addresses = await fetchOrDeriveAddresses(ownershipIds[0])
    } catch (error) {
      log.error("Failed to fetch addresses after binding", error)
    }

    try {
      unlinked = await computeUnlinkedOwnerships(manager)
    } catch (error) {
      log.error("Failed to compute unlinked ownerships after binding", error)
    }

    setState((prev) => ({
      ...prev,
      status: "ready",
      ownershipId: ownershipIds[0],
      identity: details.identity,
      recoveryState: details.recoveryState,
      ownershipCreatedAt: details.ownershipCreatedAt,
      derivedAddresses: addresses,
      unlinkedOwnerships: unlinked,
    }))
    if (unlinked.length === 0) setShowUnlinkedAlert(false)
  }, [session?.user, getManager, loadOwnershipDetails, fetchOrDeriveAddresses, computeUnlinkedOwnerships])

  const refreshOwnership = useCallback(async () => {
    if (!state.ownershipId) return

    const manager = await getManager()
    const details = await loadOwnershipDetails(manager, state.ownershipId)

    setState((prev) => ({
      ...prev,
      identity: details.identity,
      recoveryState: details.recoveryState,
      ownershipCreatedAt: details.ownershipCreatedAt,
    }))
  }, [state.ownershipId, getManager, loadOwnershipDetails])

  const refreshRecoveryState = useCallback(async () => {
    if (!state.ownershipId) return

    const manager = await getManager()
    const record = await manager.db.getOwnership(state.ownershipId)
    if (record) {
      setState((prev) => ({
        ...prev,
        recoveryState: (record.recovery?.state || "none") as "none" | "created" | "verified",
      }))
    }
  }, [state.ownershipId, getManager])

  const refreshUnlinkedOwnerships = useCallback(async () => {
    const manager = await getManager()
    const unlinked = await computeUnlinkedOwnerships(manager)
    setState((prev) => ({ ...prev, unlinkedOwnerships: unlinked }))
    if (unlinked.length === 0) setShowUnlinkedAlert(false)
  }, [getManager, computeUnlinkedOwnerships])

  const refreshAddresses = useCallback(async (ownershipId?: string) => {
    const targetId = ownershipId || state.ownershipId
    if (!targetId) return

    const addresses = await fetchOrDeriveAddresses(targetId)
    setState((prev) => ({ ...prev, derivedAddresses: addresses }))
  }, [state.ownershipId, fetchOrDeriveAddresses])

  const getMnemonic = useCallback(async (ownershipId: string): Promise<string> => {
    const manager = await getManager()
    return manager.getMnemonic(ownershipId)
  }, [getManager])

  const deleteUnlinkedOwnership = useCallback(async (ownershipId: string) => {
    const manager = await getManager()
    await manager.db.deleteOwnership(ownershipId)
    const unlinked = await computeUnlinkedOwnerships(manager)
    setState((prev) => ({ ...prev, unlinkedOwnerships: unlinked }))
    if (unlinked.length === 0) setShowUnlinkedAlert(false)
  }, [getManager, computeUnlinkedOwnerships])

  const dismissUnlinkedAlert = useCallback(() => {
    setShowUnlinkedAlert(false)
  }, [])

  const handleOwnershipRestored = useCallback(() => {
    managerRef.current = null
    initStartedRef.current = false
    setState((prev) => ({ ...prev, status: "loading" }))
    setTimeout(() => {
      initStartedRef.current = false
    }, 0)
  }, [])

  // ── Context value ──────────────────────────────────────────────────────

  const value: OwnershipContextType = {
    ...state,
    showUnlinkedAlert,
    switchOwnership,
    createOwnership,
    bindOwnership,
    bindMultipleOwnerships,
    refreshOwnership,
    refreshRecoveryState,
    refreshUnlinkedOwnerships,
    refreshAddresses,
    getMnemonic,
    handleOwnershipRestored,
    deleteUnlinkedOwnership,
    dismissUnlinkedAlert,
    getManager,
  }

  return <OwnershipContext.Provider value={value}>{children}</OwnershipContext.Provider>
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useOwnership() {
  const context = useContext(OwnershipContext)
  if (context === undefined) {
    throw new Error("useOwnership must be used within OwnershipProvider")
  }
  return context
}
