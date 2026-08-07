"use client";

import Image from "next/image";
import { useEffect } from "react";

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
        className="relative flex h-[85vh] w-full max-w-5xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {isPdf ? (
          <>
            <iframe
              src={src}
              title={alt || "PDF"}
              className="h-full w-full flex-1 rounded-xl bg-white"
            />
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="mt-3 self-center rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
            >
              PDF&apos;i yeni sekmede aç
            </a>
          </>
        ) : (
          <div className="relative h-full w-full">
            <Image
              src={src}
              alt={alt}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
        )}
      </div>
    </div>
  );
}
