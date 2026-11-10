"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StorageImage from "@/components/StorageImage";
import { formatPrice } from "@/lib/format";
import { storeImage, trendyolHref, whatsappHref } from "@/lib/storefront";

function discountPercent(price, listPrice) {
  if (!(price > 0) || !(listPrice > price)) return 0;
  return Math.round(((listPrice - price) / listPrice) * 100);
}

export default function ProductBuy({ product }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const variant = product.variants[variantIndex] || product.variants[0];
  const unitPrice = variant?.price || 0;
  const listPrice = variant?.listPrice || 0;
  const total = unitPrice * quantity;
  const discount = discountPercent(unitPrice, listPrice);
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
      <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
        <Link href="/" className="font-medium text-zinc-700 hover:text-orange-700">
          Ürünler
        </Link>
        {product.category ? (
          <>
            <span aria-hidden="true">/</span>
            <span>{product.category}</span>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="line-clamp-1 text-zinc-400">{product.title}</span>
      </nav>

      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
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
            {discount > 0 ? (
              <span className="absolute left-3 top-3 rounded-full bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                %{discount} indirim
              </span>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Görsel ${index + 1}`}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white ${
                    index === imageIndex
                      ? "border-zinc-900 ring-1 ring-zinc-900"
                      : "border-zinc-200"
                  }`}
                >
                  <StorageImage src={storeImage(url, 160)} alt="" fill />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {[product.brand, product.category].filter(Boolean).join(" · ") ||
              "Ontic"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {product.title}
          </h1>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
              {discount > 0 ? (
                <p className="text-sm text-zinc-400 line-through">
                  {formatPrice(listPrice)}
                </p>
              ) : null}
              <p className="text-2xl font-semibold text-orange-700">
                {unitPrice > 0 ? formatPrice(unitPrice) : "Fiyat için yazın"}
              </p>
              {discount > 0 ? (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                  %{discount}
                </span>
              ) : null}
            </div>

            {showVariantPicker ? (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Seçenek
                </span>
                <select
                  value={variantIndex}
                  onChange={(event) =>
                    setVariantIndex(Number(event.target.value))
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-base outline-none ring-orange-500 focus:bg-white focus:ring-2"
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

            <div className="mt-4">
              <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                Adet
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQty(quantity - 1)}
                  className="h-12 w-12 rounded-xl border border-zinc-200 bg-zinc-50 text-xl font-semibold"
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
                  className="h-12 w-12 rounded-xl border border-zinc-200 bg-zinc-50 text-xl font-semibold"
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

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-emerald-600 px-4 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                WhatsApp ile satın al
              </a>
              <a
                href={trendyolHref(product.contentId, product.title)}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-orange-600 px-4 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-orange-700"
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

          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">
              Ürün açıklaması
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-600 sm:text-base">
              {product.description ||
                "Bu ürün el emeği koleksiyonumuzun parçasıdır. Adet ve teslimat için WhatsApp’tan yazabilirsiniz."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
