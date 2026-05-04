"use client"

import { useState } from "react"
import { ContactForm } from "@/components/contact-form"

type ContactLinkProps = {
  children: React.ReactNode
  topic?: string
  className?: string
}

export function ContactLink({ children, topic, className }: ContactLinkProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      <ContactForm open={open} onOpenChange={setOpen} defaultTopic={topic} />
    </>
  )
}
