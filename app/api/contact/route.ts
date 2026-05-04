import { NextRequest, NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_BOT_ADMIN = process.env.TELEGRAM_BOT_ADMIN

export async function POST(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_BOT_ADMIN) {
    return NextResponse.json(
      { error: "Contact form is not configured" },
      { status: 500 }
    )
  }

  try {
    const { topic, name, email, message } = await req.json()

    if (!topic || !message) {
      return NextResponse.json(
        { error: "Topic and message are required" },
        { status: 400 }
      )
    }

    const text = [
      `📬 *New Contact Form Submission*`,
      ``,
      `*Topic:* ${escapeMarkdown(topic)}`,
      name ? `*Name:* ${escapeMarkdown(name)}` : null,
      email ? `*Email:* ${escapeMarkdown(email)}` : null,
      ``,
      `*Message:*`,
      escapeMarkdown(message),
    ]
      .filter(Boolean)
      .join("\n")

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_BOT_ADMIN,
          text,
          parse_mode: "MarkdownV2",
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      console.error("Telegram API error:", err)
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&")
}
