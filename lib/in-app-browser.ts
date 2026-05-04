export type InAppBrowserInfo = {
  isInAppBrowser: boolean
  browser: string | null
  appName: string | null
  instructions: string | null
}

const BROWSER_PATTERNS: { pattern: RegExp; key: string }[] = [
  { pattern: /Instagram/i, key: "instagram" },
  { pattern: /FBAN|FBAV/i, key: "facebook" },
  { pattern: /Twitter/i, key: "twitter" },
  { pattern: /Telegram[-_ ]?(Android|iOS)?/i, key: "telegram" },
  { pattern: /TikTok|BytedanceWebview/i, key: "tiktok" },
  { pattern: /Snapchat/i, key: "snapchat" },
  { pattern: /LinkedIn/i, key: "linkedin" },
  { pattern: /Line\//i, key: "line" },
  { pattern: /MicroMessenger/i, key: "wechat" },
]

const INSTRUCTIONS: Record<string, { appName: string; steps: string }> = {
  instagram: {
    appName: "Instagram",
    steps: "Tap the three dots (\u22EF) in the top right, then select \"Open in external browser\"",
  },
  facebook: {
    appName: "Facebook",
    steps: "Tap the three dots (\u22EF) in the bottom right, then select \"Open in external browser\"",
  },
  twitter: {
    appName: "X (Twitter)",
    steps: "Tap the share icon at the bottom, then select \"Open in browser\"",
  },
  telegram: {
    appName: "Telegram",
    steps: "Tap the three dots (\u22EF) in the top right, then select \"Open in\u2026\" and choose your browser",
  },
  tiktok: {
    appName: "TikTok",
    steps: "Tap the three dots (\u22EF) in the top right, then select \"Open in external browser\"",
  },
  snapchat: {
    appName: "Snapchat",
    steps: "Tap the three dots (\u22EF) at the top, then select \"Open in external browser\"",
  },
  linkedin: {
    appName: "LinkedIn",
    steps: "Tap the three dots (\u22EF) in the top right, then select \"Open in external browser\"",
  },
  line: {
    appName: "LINE",
    steps: "Tap the share icon at the bottom right, then select \"Open in external browser\"",
  },
  wechat: {
    appName: "WeChat",
    steps: "Tap the three dots (\u22EF) in the top right, then select \"Open in browser\"",
  },
  "generic-webview": {
    appName: "this app",
    steps: "Look for a menu option to \"Open in external browser\" or copy the link below and paste it into Safari or Chrome",
  },
}

function isGenericWebView(ua: string): boolean {
  // Android WebView includes "; wv)" in the UA string
  if (/; wv\)/.test(ua)) return true

  // iOS WebViews: contain "iPhone" or "iPad" but do NOT contain "Safari/"
  // (Real Safari and Chrome on iOS include "Safari/" in their UA)
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) return true

  return false
}

export function detectInAppBrowser(
  userAgent: string,
  options?: { hasTelegramProxy?: boolean },
): InAppBrowserInfo {
  const none: InAppBrowserInfo = {
    isInAppBrowser: false,
    browser: null,
    appName: null,
    instructions: null,
  }

  if (!userAgent) return none

  // Check specific app patterns first
  for (const { pattern, key } of BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) {
      const info = INSTRUCTIONS[key]
      return {
        isInAppBrowser: true,
        browser: key,
        appName: info.appName,
        instructions: info.steps,
      }
    }
  }

  // Telegram iOS uses SFSafariViewController with a standard Safari UA,
  // so UA detection fails. Check for TelegramWebviewProxy global instead
  // (works for Telegram Mini Apps / Bot WebApps).
  if (options?.hasTelegramProxy) {
    const info = INSTRUCTIONS["telegram"]
    return {
      isInAppBrowser: true,
      browser: "telegram",
      appName: info.appName,
      instructions: info.steps,
    }
  }

  // Fall back to generic WebView detection
  if (isGenericWebView(userAgent)) {
    const info = INSTRUCTIONS["generic-webview"]
    return {
      isInAppBrowser: true,
      browser: "generic-webview",
      appName: info.appName,
      instructions: info.steps,
    }
  }

  return none
}
