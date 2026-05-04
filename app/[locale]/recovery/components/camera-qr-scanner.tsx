"use client"

import { logger } from "@/lib/logger"
import { useEffect, useRef, useState, useCallback } from "react"
import type { Html5Qrcode } from "html5-qrcode"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { X, Camera } from "lucide-react"
import { Card } from "@/components/ui/card"

const log = logger("recovery")

interface CameraQRScannerProps {
  onScan: (data: string) => void
  onClose: () => void
}

export function CameraQRScanner({ onScan, onClose }: CameraQRScannerProps) {
  const t = useTranslations("recovery.scanner")
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const hasScannedRef = useRef(false)

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = await scannerRef.current.getState()
        if (state === 2) {
          // 2 means scanning is active
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (err) {
        log.error("Error stopping scanner", err)
      }
    }
  }, [])

  const startScanning = useCallback(async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const scanner = new Html5Qrcode("qr-reader")
      scannerRef.current = scanner

      const config = {
        fps: 30, // Increased from 10 to 30 for faster scanning
        qrbox: { width: 280, height: 280 }, // Slightly larger scan area
        aspectRatio: 1.0,
        disableFlip: false, // Allow flipped QR codes
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Use native barcode detector if available (faster on modern browsers)
        },
      }

      await scanner.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          // Only process first scan
          if (!hasScannedRef.current) {
            hasScannedRef.current = true
            // Stop camera completely before calling onScan
            await stopScanning()
            onScan(decodedText)
          }
        },
        (_errorMessage) => {
          // Silently ignore scan errors (happens constantly while scanning)
        },
      )

      setError(null)
    } catch (err) {
      log.error("Camera scanner error", err)
      const errorMsg = err instanceof Error ? err.message : ""

      if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission")) {
        setError(t("permissionDenied"))
      } else if (errorMsg.includes("NotFoundError")) {
        setError(t("notFound"))
      } else {
        setError(t("genericError"))
      }
    }
  }, [onScan, stopScanning, t])

  useEffect(() => {
    startScanning()

    return () => {
      stopScanning()
    }
  }, [startScanning, stopScanning])

  const handleClose = async () => {
    await stopScanning()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="relative">
            <Button variant="ghost" size="icon" className="absolute right-2 top-2 z-10" onClick={handleClose} aria-label={t("closeAria")}>
              <X className="h-4 w-4" />
            </Button>

            <div className="p-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Camera className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold">{t("title")}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{t("instructions")}</p>
              </div>

              {error ? (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200 text-center">{error}</p>
                </div>
              ) : (
                <div className="relative">
                  <div
                    id="qr-reader"
                    className="rounded-lg overflow-hidden"
                    style={{ width: "100%", maxWidth: "400px", margin: "0 auto" }}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-xs text-muted-foreground">{t("autoScanHint")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
