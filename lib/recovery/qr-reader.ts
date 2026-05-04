import jsQR from "jsqr"
import { logger } from "@/lib/logger"

const log = logger("recovery")

// Dynamic import to avoid SSR issues
let pdfjsLib: typeof import("pdfjs-dist") | null = null

/**
 * Converts image data to pure black/white using luminance threshold.
 * Helps jsQR detect styled QR codes (rounded dots, branded overlays).
 */
function binarizeImageData(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const val = lum < 128 ? 0 : 255
    data[i] = val
    data[i + 1] = val
    data[i + 2] = val
    // alpha stays the same
  }
  return new ImageData(data, imageData.width, imageData.height)
}

/**
 * Attempts to read QR code from image data with multiple strategies
 */
function attemptQRRead(imageData: ImageData, _description: string): string | null {
  const strategies = ["dontInvert", "onlyInvert", "attemptBoth"] as const

  for (const strategy of strategies) {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: strategy,
    })

    if (code) {
      return code.data
    }
  }

  return null
}

/**
 * Reads QR code from an image file with multiple scale attempts
 */
export async function readQRFromImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null)
    }, 30000)

    const img = new Image()

    img.crossOrigin = "anonymous"

    img.onload = async () => {
      clearTimeout(timeout)

      try {
        await img.decode()
      } catch {
        // Continue anyway - decode failure is non-fatal
      }

      // Try multiple scales: downscale first (helps with large branded QRs), then upscale
      const scales = [0.5, 0.75, 1, 1.5, 2, 3]

      for (const scale of scales) {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d", { willReadFrequently: true })

        if (!ctx) continue

        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)

        // Use high quality image rendering
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"

        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

          // Try raw image first
          const result = attemptQRRead(imageData, `image at ${scale}x scale (${canvas.width}x${canvas.height})`)
          if (result) {
            URL.revokeObjectURL(img.src)
            resolve(result)
            return
          }

          // Try binarized (black/white threshold) - helps with styled QR codes
          const binarized = binarizeImageData(imageData)
          const binResult = attemptQRRead(binarized, `binarized image at ${scale}x scale`)
          if (binResult) {
            URL.revokeObjectURL(img.src)
            resolve(binResult)
            return
          }
        } catch {
          continue
        }
      }

      URL.revokeObjectURL(img.src)
      resolve(null)
    }

    img.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(img.src)
      resolve(null)
    }

    try {
      const objectUrl = URL.createObjectURL(file)
      img.src = objectUrl
    } catch {
      clearTimeout(timeout)
      resolve(null)
    }
  })
}

/**
 * Reads QR code from PDF - renders page to PNG then uses the image reader,
 * which has proven more reliable (multi-scale, binarization, etc).
 * Also tries direct image extraction as a fast path.
 */
export async function readQRFromPDF(file: File): Promise<string | null> {
  try {
    if (!pdfjsLib) {
      pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
    }

    const arrayBuffer = await file.arrayBuffer()

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise

    if (pdf.numPages === 0) {
      return null
    }

    const page = await pdf.getPage(1)

    // Render page at high resolution first (needed to resolve image objects too)
    const scale = 4
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d", { willReadFrequently: true })
    canvas.width = viewport.width
    canvas.height = viewport.height

    if (!context) return null

    context.imageSmoothingEnabled = false
    await page.render({ canvasContext: context, viewport }).promise

    // Strategy 1: Try direct image extraction (objects are loaded after render)
    const OPS = pdfjsLib.OPS
    if (OPS) {
      try {
        const ops = await page.getOperatorList()
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] !== OPS.paintImageXObject) continue

          const imageName = ops.argsArray[i][0] as string
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let raw: any = null
          try {
            raw = page.objs.get(imageName)
          } catch {
            try { raw = page.commonObjs.get(imageName) } catch { continue }
          }
          if (!raw?.data || !raw.width || !raw.height) continue

          const pixelCount = raw.width * raw.height
          let rgbaData: Uint8ClampedArray
          if (raw.data.length === pixelCount * 4) {
            rgbaData = new Uint8ClampedArray(raw.data)
          } else if (raw.data.length === pixelCount * 3) {
            rgbaData = new Uint8ClampedArray(pixelCount * 4)
            for (let p = 0; p < pixelCount; p++) {
              rgbaData[p * 4] = raw.data[p * 3]
              rgbaData[p * 4 + 1] = raw.data[p * 3 + 1]
              rgbaData[p * 4 + 2] = raw.data[p * 3 + 2]
              rgbaData[p * 4 + 3] = 255
            }
          } else { continue }

          const imageData = new ImageData(new Uint8ClampedArray(rgbaData), raw.width, raw.height)
          const result = attemptQRRead(imageData, `extracted image`)
          if (result) return result
          const binarized = binarizeImageData(imageData)
          const binResult = attemptQRRead(binarized, `binarized extracted image`)
          if (binResult) return binResult
        }
      } catch {
        // Extraction failed, continue to canvas approach
      }
    }

    // Strategy 2: Convert rendered page to PNG blob and use the image reader
    // This leverages the proven multi-scale + binarization logic from readQRFromImage
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png")
    })

    if (blob) {
      const pngFile = new File([blob], "page.png", { type: "image/png" })
      const result = await readQRFromImage(pngFile)
      if (result) return result
    }

    return null
  } catch (error) {
    log.error("Error reading QR from PDF", error)
    return null
  }
}

/**
 * Parses recovery QR data and validates structure
 */
export function parseRecoveryQR(qrData: string): {
  version: number
  type: string
  ownership_id: string
  crypto: {
    algo: string
    kdf: string
    data: string
    iv: string
    salt: string
  }
} | null {
  try {
    const parsed = JSON.parse(qrData)

    // Validate structure
    if (
      parsed.v !== 1 ||
      parsed.type !== "recovery" ||
      !parsed.oid ||
      !parsed.crypto?.data ||
      !parsed.crypto?.iv ||
      !parsed.crypto?.salt
    ) {
      return null
    }

    return {
      version: parsed.v,
      type: parsed.type,
      ownership_id: parsed.oid,
      crypto: {
        algo: parsed.crypto.algo,
        kdf: parsed.crypto.kdf,
        data: parsed.crypto.data,
        iv: parsed.crypto.iv,
        salt: parsed.crypto.salt,
      },
    }
  } catch {
    return null
  }
}
