"use client";

import Image from "next/image";
import { useEffect } from "react";

export default function ImageLightbox({ src, alt = "Görsel", onClose }) {
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
      aria-label="Görsel önizleme"
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
        className="relative h-[85vh] w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          sizes="100vw"
          priority
        />
      </div>
    </div>
  );
}
