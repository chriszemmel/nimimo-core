"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Topic keys are stable identifiers - the visible label comes from
// `t("topics.<key>")`. Keep these in lockstep with `contactForm.topics`
// in messages/*.json.
const TOPIC_KEYS = [
  "general",
  "legal",
  "privacy",
  "account",
  "bug",
  "feature",
  "partnership",
  "other",
] as const

type ContactFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTopic?: string
}

export function ContactForm({ open, onOpenChange, defaultTopic }: ContactFormProps) {
  const t = useTranslations("contactForm")
  const [topic, setTopic] = useState(defaultTopic ?? "")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("sending")

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, name, email, message }),
      })

      if (!res.ok) throw new Error()
      setStatus("sent")
      setTopic(defaultTopic ?? "")
      setName("")
      setEmail("")
      setMessage("")
    } catch {
      setStatus("error")
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) setStatus("idle")
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {status === "sent" ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">{t("sentTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("sentBody")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => handleOpenChange(false)}
            >
              {t("close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">{t("topicLabel")}</Label>
              <select
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="" disabled>
                  {t("topicPlaceholder")}
                </option>
                {TOPIC_KEYS.map((key) => (
                  <option key={key} value={t(`topics.${key}`)}>
                    {t(`topics.${key}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {t("nameLabel")} <span className="text-muted-foreground font-normal">{t("optional")}</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                {t("emailLabel")} <span className="text-muted-foreground font-normal">{t("optional")}</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{t("messageLabel")}</Label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                placeholder={t("messagePlaceholder")}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none resize-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>

            {status === "error" && (
              <p className="text-xs text-destructive">
                {t("errorGeneric")}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={status === "sending"}>
              {status === "sending" ? t("sending") : t("sendButton")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
