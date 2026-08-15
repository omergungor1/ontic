"use client";

import { useEffect, useState } from "react";

function isPdfUrl(url) {
  if (!url) return false;
  try {
    const path = new URL(url, "https://local").pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return String(url).toLowerCase().includes(".pdf");
  }
}

export default function ImageLightbox({ src, alt = "Görsel", onClose }) {
  const isPdf = isPdfUrl(src);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  useEffect(() => {
    if (!src) return undefined;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isPdf ? "PDF önizleme" : "Görsel önizleme"}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="absolute right-4 top-4 z-[101] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl font-light text-white backdrop-blur hover:bg-white/25"
      >
        ×
      </button>

      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isPdf ? (
          <>
            <iframe
              src={src}
              title={alt || "PDF"}
              className="h-[75vh] w-full flex-1 rounded-xl bg-white"
            />
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="mt-3 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
            >
              PDF&apos;i yeni sekmede aç
            </a>
          </>
        ) : imageError ? (
          <div className="flex flex-col items-center gap-4 px-4 text-center text-white">
            <p className="text-sm text-white/80">
              Görsel önizleme yüklenemedi
            </p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900"
            >
              Görseli yeni sekmede aç
            </a>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              decoding="async"
              className="max-h-[80vh] w-auto max-w-full object-contain"
              onError={() => setImageError(true)}
            />
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="mt-3 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
            >
              Görseli yeni sekmede aç
            </a>
          </>
        )}
      </div>
    </div>
  );
}
