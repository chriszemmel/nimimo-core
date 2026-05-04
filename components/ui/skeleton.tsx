import type React from "react"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("bg-muted/40 animate-pulse-soft rounded-md", className)} {...props} />
}

export { Skeleton }
