"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StorageImage from "@/components/StorageImage";
import { formatPrice } from "@/lib/format";
import { storeImage, trendyolHref, whatsappHref } from "@/lib/storefront";

export default function ProductBuy({ product }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const variant = product.variants[variantIndex] || product.variants[0];
  const unitPrice = variant?.price || 0;
  const total = unitPrice * quantity;
  const images = product.images.length ? product.images : [];
  const activeImage = images[imageIndex] || images[0] || "";
  const showVariantPicker = product.variants.length > 1;

  const whatsappUrl = useMemo(
    () =>
      whatsappHref({
        title: product.title,
        quantity,
        variantLabel: showVariantPicker ? variant?.label : "",
        unitLabel: unitPrice > 0 ? formatPrice(unitPrice) : "",
        totalLabel: unitPrice > 0 ? formatPrice(total) : "",
      }),
    [product.title, quantity, showVariantPicker, variant?.label, unitPrice, total]
  );

  function setQty(next) {
    const value = Math.min(99, Math.max(1, Number(next) || 1));
    setQuantity(value);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
      <Link
        href="/"
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Ürünlere dön
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-zinc-200 bg-white">
            {activeImage ? (
              <StorageImage
                src={storeImage(activeImage, 900)}
                alt={product.title}
                fill
                objectFit="contain"
                priority
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                Görsel yok
              </span>
            )}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Görsel ${index + 1}`}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${
                    index === imageIndex
                      ? "border-zinc-900"
                      : "border-zinc-200"
                  }`}
                >
                  <StorageImage
                    src={storeImage(url, 160)}
                    alt=""
                    fill
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {[product.brand, product.category].filter(Boolean).join(" · ") ||
              "Ontic"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {product.title}
          </h1>
          <div className="mt-4">
            {variant?.listPrice > unitPrice && unitPrice > 0 ? (
              <p className="text-sm text-zinc-400 line-through">
                {formatPrice(variant.listPrice)}
              </p>
            ) : null}
            <p className="text-2xl font-semibold text-orange-700">
              {unitPrice > 0 ? formatPrice(unitPrice) : "Fiyat için yazın"}
            </p>
          </div>

          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-zinc-600 sm:text-base">
            {product.description ||
              "Bu ürün el emeği koleksiyonumuzun parçasıdır. Adet ve teslimat için WhatsApp’tan yazabilirsiniz."}
          </p>

          {showVariantPicker ? (
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium">Seçenek</span>
              <select
                value={variantIndex}
                onChange={(event) => setVariantIndex(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-base outline-none ring-orange-500 focus:ring-2"
              >
                {product.variants.map((item, index) => (
                  <option key={`${item.label}-${index}`} value={index}>
                    {item.label}
                    {item.price > 0 ? ` · ${formatPrice(item.price)}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="mt-5">
            <span className="mb-1.5 block text-sm font-medium">Adet</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty(quantity - 1)}
                className="h-12 w-12 rounded-xl border border-zinc-200 bg-white text-xl font-semibold"
                aria-label="Adedi azalt"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={quantity}
                onChange={(event) => setQty(event.target.value)}
                className="h-12 w-20 rounded-xl border border-zinc-200 bg-white text-center text-base font-semibold outline-none ring-orange-500 focus:ring-2"
                aria-label="Adet"
              />
              <button
                type="button"
                onClick={() => setQty(quantity + 1)}
                className="h-12 w-12 rounded-xl border border-zinc-200 bg-white text-xl font-semibold"
                aria-label="Adedi artır"
              >
                +
              </button>
              {unitPrice > 0 ? (
                <p className="ml-auto text-right text-sm text-zinc-600">
                  Toplam
                  <span className="mt-0.5 block text-base font-semibold text-zinc-900">
                    {formatPrice(total)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-emerald-600 px-4 py-3.5 text-center text-sm font-semibold text-white"
            >
              WhatsApp ile satın al
            </a>
            <a
              href={trendyolHref(product.contentId, product.title)}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-orange-600 px-4 py-3.5 text-center text-sm font-semibold text-white"
            >
              Trendyol ile satın al
            </a>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            WhatsApp, ürün adı ve adet yazılı hazır mesajı açar. Ödeme bu
            sitede alınmaz ve sipariş kaydı tutulmaz.
            {product.contentId
              ? " Trendyol düğmesi ürün sayfasını açar."
              : " Bu ürünün Trendyol kaydı yoksa mağaza araması açılır."}
          </p>
        </div>
      </div>
    </div>
  );
}
