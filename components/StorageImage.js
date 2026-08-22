"use client";

/**
 * Supabase Storage vb. harici görseller için doğrudan <img> kullanır.
 * next/image optimizasyonu mobilde Supabase URL'lerinde kırılabiliyor.
 */
export default function StorageImage({
  src,
  alt = "",
  className = "",
  fill = false,
  objectFit = "cover",
}) {
  if (!src) return null;

  const fitClass =
    objectFit === "contain" ? "object-contain" : "object-cover";

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        decoding="async"
        className={`absolute inset-0 h-full w-full ${fitClass} ${className}`.trim()}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} decoding="async" className={className} />
  );
}
