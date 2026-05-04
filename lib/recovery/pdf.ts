// All user-visible text in the recovery PDF is resolved by the
// caller (a React component with access to `useTranslations`) and
// passed in via this bundle. jsPDF itself has no idea about locales
// and we can't use `useTranslations` inside a non-React module, so
// the strings travel across the call boundary as plain resolved
// strings. Every field that used to be a hardcoded English literal
// is now here - if you're adding a new line to the PDF, add the key
// to `messages/en.json` under `recovery.pdf`, add it to this type,
// pass it from the caller, and use it inside `generateRecoveryPDF`.
export interface RecoveryPDFStrings {
  title: string
  identityLine: string
  createdLine: string
  securedWith: string
  credentialLabel: string
  cutLineHint: string
  instructionsHeading: string
  instructions: [string, string, string, string]
  page2Title: string
  technicalInformation: string
  labelOwnershipId: string
  labelMethod: string
  labelSalt: string
  labelIv: string
  labelEncryptedData: string
  securityNoticeHeading: string
  securityNotices: [string, string, string, string, string]
  footer: string
}

export interface RecoveryPDFData {
  ownership_id: string
  identity: string
  encryptedData: string
  iv: string
  salt: string
  createdAt: number
  qrCanvas: HTMLCanvasElement
  securityMethod: "pin" | "password"
  securityCredential: string
  strings: RecoveryPDFStrings
}

// CJK detection: Han (Chinese), Hangul (Korean), Hiragana, Katakana,
// full-width punctuation, and the common CJK symbol ranges. jsPDF's
// built-in helvetica/courier fonts only cover Latin-1 extended, so
// anything in these ranges renders as mojibake (the "Ž«Nÿ"-style
// garbage the user was seeing on the Chinese recovery PDF).
//
// The fix below sidesteps the problem entirely for CJK: render the
// glyphs to an offscreen canvas using the browser's own font stack
// (macOS has PingFang SC, Windows has Microsoft YaHei, Android has
// Noto Sans CJK, iOS has PingFang SC - every end-user device has at
// least one) and embed the rasterized canvas as a PNG in the PDF.
// Trade-off: CJK runs are not selectable text in the resulting PDF,
// but they render correctly at print resolution, which is what
// matters for a physical recovery card. Latin runs stay native
// jsPDF text so most of the document is still crisp vector type.
const CJK_RE = /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef\uac00-\ud7af\u30a0-\u30ff\u3040-\u309f]/

function hasCJK(text: string): boolean {
  return CJK_RE.test(text)
}

// Target DPI for rasterized CJK text. 300 DPI is the print standard;
// higher than that makes PDF files larger for no visible benefit at
// typical home-printer resolution.
const PDF_DPI = 300
const PT_TO_MM = 25.4 / 72
const MM_PER_INCH = 25.4
const PX_PER_MM_AT_PDF_DPI = PDF_DPI / MM_PER_INCH

// Sans-serif stack biased toward CJK coverage. Order matters: we list
// the native CJK fonts Apple, Microsoft, and Google ship, so whichever
// device is printing gets the glyphs its users are already familiar
// with. Falls back to the browser's default sans if none match.
const CJK_SANS_STACK =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Apple SD Gothic Neo", "Malgun Gothic", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif'
const CJK_MONO_STACK =
  '"Menlo", "Consolas", "Liberation Mono", "Courier New", monospace'

type DrawTextOpts = {
  fontSize: number // pt, matches jsPDF's setFontSize
  fontStyle?: "normal" | "bold"
  color: [number, number, number] // RGB 0-255
  align?: "left" | "center" | "right"
  monospace?: boolean
}

/**
 * Draw a string to the PDF at (x, y) with the given style. For
 * Latin-only text this is a thin wrapper over jsPDF's native
 * `pdf.text()` - same crispness, same selectability. For text that
 * contains CJK codepoints (which jsPDF's bundled fonts can't render)
 * it falls back to rasterizing the run to an offscreen canvas using
 * the browser's own font stack, then embeds the canvas as a PNG at
 * the computed PDF position. Alignment and baseline match native
 * `pdf.text()` behavior so callers don't need to special-case.
 */
function drawText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  text: string,
  x: number,
  y: number,
  opts: DrawTextOpts,
): void {
  const fontStyle = opts.fontStyle ?? "normal"
  const align = opts.align ?? "left"

  if (!hasCJK(text)) {
    // Fast path: native jsPDF vector text for Latin strings.
    pdf.setFontSize(opts.fontSize)
    pdf.setFont(opts.monospace ? "courier" : "helvetica", fontStyle)
    pdf.setTextColor(opts.color[0], opts.color[1], opts.color[2])
    pdf.text(text, x, y, { align })
    return
  }

  // Slow path: rasterize via canvas using the browser's CJK fonts.
  const fontSizeMm = opts.fontSize * PT_TO_MM
  const fontSizePx = Math.ceil(fontSizeMm * PX_PER_MM_AT_PDF_DPI)
  const fontFamily = opts.monospace ? CJK_MONO_STACK : CJK_SANS_STACK
  const cssFont = `${fontStyle === "bold" ? "bold " : ""}${fontSizePx}px ${fontFamily}`

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    // Canvas context unavailable (should never happen in a modern
    // browser PWA, but fall back rather than crash the whole flow).
    pdf.setFontSize(opts.fontSize)
    pdf.setFont(opts.monospace ? "courier" : "helvetica", fontStyle)
    pdf.setTextColor(opts.color[0], opts.color[1], opts.color[2])
    pdf.text(text, x, y, { align })
    return
  }

  // First measurement pass to size the canvas. Font must be set
  // *before* measureText for correct metrics.
  ctx.font = cssFont
  const metrics = ctx.measureText(text)
  const ascent = metrics.actualBoundingBoxAscent || fontSizePx * 0.8
  const descent = metrics.actualBoundingBoxDescent || fontSizePx * 0.2
  const textWidthPx = Math.max(1, Math.ceil(metrics.width))
  const textHeightPx = Math.max(1, Math.ceil(ascent + descent))

  canvas.width = textWidthPx
  canvas.height = textHeightPx

  // Canvas state resets when dimensions change - re-apply everything.
  ctx.font = cssFont
  ctx.fillStyle = `rgb(${opts.color[0]}, ${opts.color[1]}, ${opts.color[2]})`
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"
  ctx.fillText(text, 0, ascent)

  // Convert canvas pixels back to PDF mm using the same DPI we sized at.
  const widthMm = textWidthPx / PX_PER_MM_AT_PDF_DPI
  const heightMm = textHeightPx / PX_PER_MM_AT_PDF_DPI

  // jsPDF's text() places the alphabetic baseline at y. addImage
  // places the image top-left at (x, y). Shift upward by the ascent
  // portion so the rendered baseline lands exactly where native
  // pdf.text() would have put it - mixed CJK / Latin layouts stay
  // visually aligned row-to-row.
  const ascentMm = ascent / PX_PER_MM_AT_PDF_DPI
  const drawY = y - ascentMm

  let drawX = x
  if (align === "center") drawX = x - widthMm / 2
  else if (align === "right") drawX = x - widthMm

  pdf.addImage(canvas.toDataURL("image/png"), "PNG", drawX, drawY, widthMm, heightMm)
}

/**
 * Generates a recovery PDF with QR code, encrypted data, and
 * printable password strip.
 *
 * Localization note: every English string used to be hardcoded in
 * this function. They're now supplied via `data.strings`, resolved
 * by the caller using `useTranslations("recovery.pdf")`. This keeps
 * the generator framework-agnostic and the translation layer in
 * React-land where it belongs.
 *
 * CJK note: jsPDF's bundled helvetica/courier fonts don't ship any
 * CJK glyphs, so Chinese/Japanese/Korean strings used to render as
 * Latin-1 mojibake. `drawText()` (above) transparently rasterizes
 * runs that contain CJK codepoints, so the Chinese recovery PDF now
 * renders correctly without shipping a 10 MB Noto Sans CJK font.
 */
export async function generateRecoveryPDF(data: RecoveryPDFData): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf")
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const s = data.strings
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // ========== PAGE 1: QR Code, Password, and Instructions ==========

  // Background gradient effect
  pdf.setFillColor(250, 250, 255)
  pdf.rect(0, 0, pageWidth, 60, "F")

  // Title with brand color
  drawText(pdf, s.title, pageWidth / 2, 25, {
    fontSize: 28,
    fontStyle: "bold",
    color: [59, 130, 246], // Blue-500
    align: "center",
  })

  // Identity info with better styling
  drawText(pdf, s.identityLine, pageWidth / 2, 38, {
    fontSize: 14,
    color: [71, 85, 105], // Slate-600
    align: "center",
  })

  drawText(pdf, s.createdLine, pageWidth / 2, 46, {
    fontSize: 10,
    color: [100, 116, 139], // Slate-500
    align: "center",
  })

  drawText(pdf, s.securedWith, pageWidth / 2, 52, {
    fontSize: 11,
    fontStyle: "bold",
    color: [220, 38, 38], // Red-600
    align: "center",
  })

  // QR Code with border
  const qrImage = data.qrCanvas.toDataURL("image/png")
  const qrSize = 120
  const qrX = (pageWidth - qrSize) / 2
  const qrY = 65

  // QR border and shadow effect
  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(226, 232, 240) // Slate-200
  pdf.setLineWidth(0.5)
  pdf.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 3, 3, "FD")

  pdf.addImage(qrImage, "PNG", qrX, qrY, qrSize, qrSize)

  const cutLineY = 195

  // Draw scissor cut line with dashes
  pdf.setDrawColor(100, 116, 139) // Slate-500
  pdf.setLineDashPattern([2, 2], 0)
  pdf.setLineWidth(0.3)
  pdf.line(10, cutLineY, pageWidth - 10, cutLineY)

  // "SCISSORS" decoration (visual cue, not translated - kept as
  // all-caps ASCII so it reads the same in any locale and doesn't
  // require a glyph fallback in the PDF font).
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 116, 139)
  pdf.text("SCISSORS", 8, cutLineY - 2)
  pdf.text("SCISSORS", pageWidth - 28, cutLineY - 2)

  // Reset line style
  pdf.setLineDashPattern([], 0)

  // PIN/Password section (below cut line)
  const credentialY = cutLineY + 10
  pdf.setFillColor(254, 242, 242) // Red-50
  pdf.setDrawColor(239, 68, 68) // Red-500
  pdf.setLineWidth(0.5)
  pdf.roundedRect(15, credentialY, pageWidth - 30, 35, 2, 2, "FD")

  drawText(pdf, s.credentialLabel, pageWidth / 2, credentialY + 10, {
    fontSize: 14,
    fontStyle: "bold",
    color: [153, 27, 27], // Red-900
    align: "center",
  })

  // The password itself stays on the monospace Latin path - passwords
  // are Latin alphanumeric in practice, and the fixed-width courier
  // glyphs make each character distinct when the user reads it back
  // from a printed page. `drawText` falls through to canvas if a user
  // does enter a CJK password, so this is still correct for the edge
  // case, just less crisp.
  drawText(pdf, data.securityCredential, pageWidth / 2, credentialY + 20, {
    fontSize: 20,
    fontStyle: "bold",
    color: [220, 38, 38], // Red-600
    align: "center",
    monospace: true,
  })

  drawText(pdf, s.cutLineHint, pageWidth / 2, credentialY + 28, {
    fontSize: 9,
    color: [153, 27, 27],
    align: "center",
  })

  // Instructions section with better spacing
  let yPos = credentialY + 45
  drawText(pdf, s.instructionsHeading, 20, yPos, {
    fontSize: 16,
    fontStyle: "bold",
    color: [30, 41, 59], // Slate-800
  })

  yPos += 8
  s.instructions.forEach((instruction) => {
    drawText(pdf, instruction, 25, yPos, {
      fontSize: 10,
      color: [71, 85, 105], // Slate-600
    })
    yPos += 6
  })

  pdf.addPage()

  // ========== PAGE 2: Technical Information and Security Notice ==========

  // Page 2 Header
  drawText(pdf, s.page2Title, pageWidth / 2, 25, {
    fontSize: 20,
    fontStyle: "bold",
    color: [59, 130, 246],
    align: "center",
  })

  // Technical Information section
  let page2Y = 40
  pdf.setFillColor(248, 250, 252) // Slate-50
  pdf.setDrawColor(226, 232, 240) // Slate-200
  pdf.setLineWidth(0.3)
  pdf.roundedRect(15, page2Y, pageWidth - 30, 50, 2, 2, "FD")

  drawText(pdf, s.technicalInformation, 20, page2Y + 8, {
    fontSize: 12,
    fontStyle: "bold",
    color: [71, 85, 105], // Slate-600
  })

  // Technical detail lines: label may be CJK, value is always Latin
  // hex / ASCII, so drawText's CJK detection picks the right path
  // per line without any extra branching here.
  const techColor: [number, number, number] = [100, 116, 139] // Slate-500
  drawText(pdf, `${s.labelOwnershipId}: ${data.ownership_id}`, 20, page2Y + 16, {
    fontSize: 8,
    color: techColor,
    monospace: true,
  })
  drawText(pdf, `${s.labelMethod}: ${data.securityMethod.toUpperCase()}`, 20, page2Y + 22, {
    fontSize: 8,
    color: techColor,
    monospace: true,
  })
  drawText(pdf, `${s.labelSalt}: ${data.salt.substring(0, 60)}`, 20, page2Y + 28, {
    fontSize: 8,
    color: techColor,
    monospace: true,
  })
  const saltLine2 = data.salt.substring(60)
  if (saltLine2) {
    drawText(pdf, saltLine2, 20, page2Y + 32, {
      fontSize: 8,
      color: techColor,
      monospace: true,
    })
  }
  drawText(pdf, `${s.labelIv}: ${data.iv}`, 20, page2Y + 38, {
    fontSize: 8,
    color: techColor,
    monospace: true,
  })
  drawText(pdf, `${s.labelEncryptedData}: ${data.encryptedData.substring(0, 55)}`, 20, page2Y + 44, {
    fontSize: 8,
    color: techColor,
    monospace: true,
  })

  // Warning section with enhanced styling
  page2Y += 60
  pdf.setFillColor(254, 243, 199) // Amber-100
  pdf.setDrawColor(251, 191, 36) // Amber-400
  pdf.setLineWidth(0.3)
  pdf.roundedRect(15, page2Y, pageWidth - 30, 50, 2, 2, "FD")

  drawText(pdf, s.securityNoticeHeading, 20, page2Y + 10, {
    fontSize: 14,
    fontStyle: "bold",
    color: [146, 64, 14], // Amber-800
  })

  let warningY = page2Y + 18
  s.securityNotices.forEach((warning) => {
    drawText(pdf, warning, 20, warningY, {
      fontSize: 10,
      color: [120, 53, 15], // Amber-900
    })
    warningY += 6
  })

  // Footer on page 2
  drawText(pdf, s.footer, pageWidth / 2, pageHeight - 10, {
    fontSize: 9,
    color: [148, 163, 184], // Slate-400
    align: "center",
  })

  return pdf.output("blob")
}
