"use client"

import { useState, useEffect } from "react"
import { detectInAppBrowser, type InAppBrowserInfo } from "@/lib/in-app-browser"

export function useInAppBrowser(): InAppBrowserInfo {
  const [info, setInfo] = useState<InAppBrowserInfo>({
    isInAppBrowser: false,
    browser: null,
    appName: null,
    instructions: null,
  })

  useEffect(() => {
    const hasTelegramProxy = "TelegramWebviewProxy" in window
    setInfo(detectInAppBrowser(navigator.userAgent, { hasTelegramProxy }))
  }, [])

  return info
}
