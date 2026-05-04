"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

/**
 * Renders queued toasts from `useToast()` into the DOM via the
 * Radix `ToastProvider` + `ToastViewport`. Mount this exactly once,
 * near the root of the tree - in our case inside
 * `app/[locale]/layout.tsx` alongside the other global providers.
 *
 * Without this component the `toast({ title, description })` calls
 * scattered across the app (send flow, recovery verify, identity
 * page, etc.) update the hook's internal state but never render
 * anything - the queue grows and users see nothing. That was the
 * state before v1.2.3; this file fixes it as part of the knip
 * cleanup pass that surfaced `ToastProvider`, `ToastViewport`,
 * `ToastClose`, and `ToastAction` as "unused exports" (they were
 * exported but no caller ever rendered them).
 */
export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
