/**
 * Trigger a file download from a Blob.
 *
 * Platform split (restored from the original nodl build):
 *
 * - **iOS Safari / iOS Brave / iOS Chrome (all WebKit)**: use the Web
 *   Share API with a `File`. On iOS the share sheet surfaces
 *   "Save to Files" as a prominent top-level action, and also lets the
 *   user send the recovery file to another app or AirDrop device if
 *   they want to store it off-phone. This is the behavior the earliest
 *   builds shipped with and the one users remember as "just working".
 *   A plain `<a download>` is broken on iOS for blob URLs - Safari
 *   silently ignores the `download` attribute and navigates the
 *   current tab to the PDF, destroying the in-progress verification
 *   flow.
 *
 * - **Desktop (Chrome/Firefox/Safari/Edge) and Android**: use a plain
 *   `<a href="blob:..." download>`. Browsers honor the `download`
 *   attribute and save the file directly to the default Downloads
 *   folder with their own native UI (Chrome's download shelf, Android's
 *   notification). Don't get in the way of that. The share sheet on
 *   Android is noisier than on iOS and hides the "Save" option behind
 *   messaging apps, which confused users in a previous iteration.
 *
 * The returned Promise resolves when the download / share completes
 * and rejects with a `DOMException` named `AbortError` if the user
 * cancels the iOS share sheet. Callers should treat AbortError as a
 * no-op (user changed their mind), not as an error.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isIOS()) {
    const mime = blob.type || "application/octet-stream"
    const file = new File([blob], filename, { type: mime })
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] })
      return
    }
    // Fall through to the anchor path. On very old iOS this will
    // navigate the current tab - nothing we can do without share
    // support.
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 2000)
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  if (/iPhone|iPad|iPod/.test(ua)) return true
  // iPad on iPadOS 13+ reports platform="MacIntel" but has a touch screen.
  if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1) return true
  return false
}
