"use client";

/**
 * Harici görseller (Supabase Storage, Trendyol CDN vb.) için doğrudan <img>.
 * Vercel Image Optimization kullanmaz; free planda transformation limitini tüketmez.
 */
export default function StorageImage({
  src,
  alt = "",
  className = "",
  fill = false,
  objectFit = "cover",
  priority = false,
}) {
  if (!src) return null;

  const fitClass =
    objectFit === "contain" ? "object-contain" : "object-cover";

  const loadingProps = priority
    ? { loading: "eager", fetchPriority: "high" }
    : { loading: "lazy" };

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        decoding="async"
        {...loadingProps}
        className={`absolute inset-0 h-full w-full ${fitClass} ${className}`.trim()}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      decoding="async"
      {...loadingProps}
      className={className}
    />
  );
}
