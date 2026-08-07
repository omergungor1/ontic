"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function AnnouncementSlider({ items = [] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;

  const current = items[index] || items[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white select-none">
      <div className="relative aspect-[16/9] bg-zinc-100">
        {current.image_url ? (
          <Image
            src={current.image_url}
            alt={current.title || "Duyuru"}
            fill
            className="object-cover"
            sizes="(max-width:768px) 100vw, 640px"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-500 to-rose-600 px-6 text-center">
            <p className="text-xl font-semibold text-white">{current.title}</p>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h2 className="text-lg font-semibold leading-snug">{current.title}</h2>
        {current.description ? (
          <p className="text-sm leading-relaxed text-zinc-600">
            {current.description}
          </p>
        ) : null}
        {items.length > 1 ? (
          <div className="flex items-center justify-center gap-2 pt-1">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Duyuru ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-orange-600" : "w-2.5 bg-zinc-300"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
