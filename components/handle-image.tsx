"use client"

// Stable avatar image element for handle/recipient surfaces.
//
// Why this exists: next/image (even with `images: { unoptimized: true }`
// in next.config) keeps its own React state for "loading" / "loaded" and
// emits the loaded class on the *next* commit after mount. When a parent
// container is keyed (e.g. the send-flow's `key={stepKey}` slide
// container, or the Enjin NFT dialog's mode switches), every step
// transition unmounts and remounts the avatar, and the next/image
// lifecycle costs one frame of paint. The visible result is the avatar
// briefly flashing/disappearing on every "Continue" click.
//
// A plain <img> bypasses that lifecycle. With `decoding="async"` the
// browser paints the cached pixels on the same frame as the DOM
// element is created, so cross-step navigation feels stable. We keep
// width/height set so layout doesn't shift while the image is in
// flight, and `loading="eager"` so the avatar never lazy-defers on
// re-mount.

interface Props {
  src: string
  alt: string
  size: number
  className?: string
}

export function HandleImage({ src, alt, size, className = "" }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      decoding="async"
      loading="eager"
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
