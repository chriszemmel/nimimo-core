/**
 * Client-side image resize: crops to center square, resizes to 250x250, outputs JPEG.
 * Returns a base64 data URL (without the prefix) ready for upload.
 */
export async function resizeImageToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)

  const size = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - size) / 2
  const sy = (bitmap.height - size) / 2

  const canvas = new OffscreenCanvas(250, 250)
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 250, 250)
  bitmap.close()

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 })
  return blobToBase64(blob)
}

/** Convert a Blob to a base64 string (no prefix). */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
