#!/usr/bin/env node
/**
 * The README's screenshots, taken from the running site.
 *
 *   npm i --no-save --prefix /tmp/shots playwright-core sharp
 *   NODE_PATH=/tmp/shots/node_modules node scripts/screenshots.mjs   # writes docs/screenshots/
 *
 * Nothing in a screenshot is drawn by hand. Every capture is the real page,
 * at 1024 CSS px for the desktop shots and 390 px at 2x for the phones. Only
 * the frames around them are drawn: a browser window and a phone.
 *
 * The default target is nimimo.com, which runs this core. The public profile
 * page needs a database with a claimed handle in it, so a local build without
 * one can show the landing page but not a profile; point SITE_URL at a local
 * build that has one to regenerate everything from this repository alone.
 *
 * Environment:
 *   SITE_URL       default https://nimimo.com
 *   HANDLE         the profile to show, default chris
 *   CHROMIUM_PATH  default: the browser playwright-core finds
 *   HTTPS_PROXY    passed to the browser when set
 *   CHROMIUM_ARGS  extra browser flags, space-separated
 *
 * sharp, when present, reduces each image to a palette, which cuts the bytes
 * to about a quarter.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "docs", "screenshots")
const SITE = (process.env.SITE_URL ?? "https://nimimo.com").replace(/\/$/, "")
const HANDLE = process.env.HANDLE ?? "chris"
const require = createRequire(import.meta.url)
const { chromium } = require("playwright-core")
const INTER = readFileSync(join(ROOT, "public", "fonts", "inter-latin.woff2"))

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  args: process.env.CHROMIUM_ARGS?.split(" ").filter(Boolean),
})

/** A page of the running site. The site is dark in every theme. */
async function sitePage(viewport, scale) {
  return browser.newPage({ viewport, deviceScaleFactor: scale, colorScheme: "dark", reducedMotion: "reduce" })
}
async function open(page, path) {
  await page.goto(`${SITE}${path}`, { waitUntil: "networkidle" })
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}
async function scrollToHeading(page, text, offset) {
  await page.evaluate(
    ({ text, offset }) => {
      const el = [...document.querySelectorAll("h1,h2,h3")].find((e) => e.textContent.trim().startsWith(text))
      if (!el) throw new Error(`No heading starting with "${text}"`)
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset)
    },
    { text, offset },
  )
  // Sections fade in as they scroll into view.
  await page.waitForTimeout(900)
}
async function openAddress(page, chain) {
  await page.getByText(chain, { exact: true }).first().click()
  await page.getByText("Receiving address").first().waitFor()
  // The QR code is drawn after the sheet opens.
  await page.waitForTimeout(1200)
}

// Raw captures. Desktop is 1024 CSS px wide rendered to 1600 px, the width of
// the frame; phones are 390 px at 2x under a drawn status bar.
const raw = {}
const grab = async (page, key) => {
  raw[key] = `data:image/png;base64,${(await page.screenshot()).toString("base64")}`
}
const DESKTOP = { width: 1024, height: 695 }
const D_SCALE = 1600 / 1024
const PHONE = { width: 390, height: 797 }

let page = await sitePage(DESKTOP, D_SCALE)
await open(page, "/")
await grab(page, "desktop-home")
await scrollToHeading(page, "Lose your phone.", 110)
await grab(page, "desktop-recovery")
await scrollToHeading(page, "Safe, by default.", 110)
await grab(page, "desktop-safe")
await open(page, `/@${HANDLE}`)
await grab(page, "desktop-profile")
await openAddress(page, "Bitcoin")
await grab(page, "desktop-address")
await page.close()

page = await sitePage(PHONE, 2)
await open(page, "/")
await grab(page, "phone-home")
await scrollToHeading(page, "Safe, by default.", 90)
await grab(page, "phone-safe")
await open(page, `/@${HANDLE}`)
await grab(page, "phone-profile")
await openAddress(page, "Bitcoin")
await grab(page, "phone-address")
await page.close()

// Frames.
const FRAME_FONTS = `@font-face{font-family:Sans;src:url(data:font/woff2;base64,${INTER.toString("base64")});font-weight:100 900}`
// Light and dark describe the frame, matching the reader's GitHub theme. The
// site itself is dark in both, because it is dark.
const THEMES = {
  dark: { bar: "#1c1c1f", line: "#2e2e33", border: "#3a3a40", dim: "#8b8b94" },
  light: { bar: "#f4f4f5", line: "#e4e4e7", border: "#d4d4d8", dim: "#6b6b74" },
}
const SITE_BG = "#0e0e2d"
const windowFrame = (t, { title, image }) => `<!doctype html><style>${FRAME_FONTS}
html,body{margin:0;background:transparent}
.win{width:1600px;height:1130px;border-radius:14px;overflow:hidden;border:1px solid ${t.border};box-sizing:border-box;background:${SITE_BG};display:flex;flex-direction:column}
.bar{height:44px;flex:none;background:${t.bar};border-bottom:1px solid ${t.line};display:flex;align-items:center;gap:8px;padding-left:18px;position:relative;font:500 15px Sans;color:${t.dim}}
.dot{width:12px;height:12px;border-radius:50%}
.title{position:absolute;left:0;right:0;text-align:center}
.body{flex:1;overflow:hidden}
.body img{display:block;width:100%}
</style><div class="win"><div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span class="title">${title}</span></div><div class="body"><img src="${image}"></div></div>`

const STATUS_ICONS = `<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#fff"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#fff"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5Zm-4.2-4.3L2.3 5.7a8 8 0 0 1 11.4 0l-1.5 1.5a5.9 5.9 0 0 0-8.4 0ZM.6 4 0 3.4a11.3 11.3 0 0 1 16 0l-.6.6-.9.9a10 10 0 0 0-13 0L.6 4Z" fill="#fff"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" stroke="#fff" opacity=".5" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill="#fff"/><rect x="25" y="4.5" width="1.5" height="4" rx=".75" fill="#fff" opacity=".5"/></svg>`
const phone = (key) =>
  `<div class="phone"><div class="screen"><div class="status"><span>9:41</span><span class="icons">${STATUS_ICONS}</span></div><div class="island"></div><img src="${raw[key]}"><div class="home"></div></div></div>`
const PHONES = ["phone-home", "phone-profile", "phone-address", "phone-safe"]
const phonesFrame = `<!doctype html><style>${FRAME_FONTS}
html,body{margin:0;background:transparent}
.row{width:1800px;height:910px;display:flex;justify-content:space-between;align-items:center;padding:0 24px;box-sizing:border-box}
.phone{width:410px;height:862px;border-radius:66px;background:#1d1d20;padding:12px;box-sizing:border-box;box-shadow:0 0 0 2px #3a3a3f inset,0 24px 50px rgba(0,0,0,.28)}
.screen{position:relative;width:386px;height:838px;border-radius:54px;overflow:hidden;background:${SITE_BG}}
.status{height:52px;display:flex;justify-content:space-between;align-items:center;padding:6px 30px 0 44px;box-sizing:border-box;font:600 17px Sans;color:#fff}
.icons{display:flex;gap:6px;align-items:center}
.island{position:absolute;top:11px;left:50%;width:118px;height:34px;margin-left:-59px;border-radius:20px;background:#000}
.screen img{display:block;width:386px}
.home{position:absolute;bottom:9px;left:50%;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:#fff;opacity:.85}
</style><div class="row">${PHONES.map(phone).join("")}</div>`

mkdirSync(OUT, { recursive: true })
async function compress(png) {
  try {
    const sharp = require("sharp")
    return await sharp(png).png({ palette: true, quality: 92, effort: 10, compressionLevel: 9 }).toBuffer()
  } catch {
    return png
  }
}
async function render(html, file, width, height) {
  const p = await browser.newPage({ viewport: { width, height } })
  await p.setContent(html)
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(200)
  writeFileSync(join(OUT, file), await compress(await p.screenshot({ omitBackground: true })))
  await p.close()
}

const host = new URL(SITE).host
for (const [mode, t] of Object.entries(THEMES)) {
  for (const [name, path] of [["home", ""], ["recovery", ""], ["safe", ""], ["profile", `/@${HANDLE}`], ["address", `/@${HANDLE}`]]) {
    await render(windowFrame(t, { title: `${host}${path}`, image: raw[`desktop-${name}`] }), `web-${name}-${mode}.png`, 1600, 1130)
  }
}
await render(phonesFrame, "phones.png", 1800, 910)
await browser.close()
console.log(`Wrote ${OUT}`)
