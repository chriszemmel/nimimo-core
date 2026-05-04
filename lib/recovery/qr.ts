"use client"

export interface RecoveryQROptions {
  data: string
  logo: string
  displaySize?: number
}

/**
 * Generates a branded recovery QR code
 * Similar style to blockchain receive QRs but with nimimo logo
 */
export async function generateRecoveryQR(options: RecoveryQROptions): Promise<HTMLCanvasElement> {
  const { data, logo } = options

  const { default: QRCodeStyling } = await import("qr-code-styling")
  const qrCode = new QRCodeStyling({
    width: 960,
    height: 960,
    data: data,
    margin: 5,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: "H",
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.25,
      margin: 10,
    },
    dotsOptions: {
      type: "rounded",
      color: "#000000",
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    image: logo,
    cornersSquareOptions: {
      type: "extra-rounded",
      color: "#000000",
    },
    cornersDotOptions: {
      type: "dot",
      color: "#000000",
    },
  })

  // Generate QR code
  const blob = await qrCode.getRawData("png")
  if (!blob) throw new Error("Failed to generate QR code")

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // Create final 1000x1000 canvas
      const finalCanvas = document.createElement("canvas")
      finalCanvas.width = 1000
      finalCanvas.height = 1000
      const ctx = finalCanvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Failed to get canvas context"))
        return
      }

      // White background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, 1000, 1000)

      const qrSize = 960
      const qrX = (1000 - qrSize) / 2
      const qrY = (1000 - qrSize) / 2
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize)

      resolve(finalCanvas)
    }
    img.onerror = () => reject(new Error("Failed to load QR code image"))
    img.src = URL.createObjectURL(blob as Blob)
  })
}
