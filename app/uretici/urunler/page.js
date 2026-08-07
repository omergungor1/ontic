"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import { createClient } from "@/lib/supabase/client";
import { truncate } from "@/lib/format";

export default function ProducerProductsPage() {
  const [rows, setRows] = useState([]);
  const [savedMap, setSavedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(text, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3000);
  }

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("producer_products")
      .select(
        "*, products!product_id(id, title, description, image_url, brand_name)"
      )
      .eq("producer_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    const list = data || [];
    setRows(list);
    setSavedMap(
      Object.fromEntries(
        list.map((r) => [r.id, Number(r.stock_quantity || 0)])
      )
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function isDirty(row) {
    const current = Number(row.stock_quantity || 0);
    const saved = Number(savedMap[row.id] ?? 0);
    return current !== saved;
  }

  function updateStock(id, value) {
    const next = Math.max(0, Number(value || 0));
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, stock_quantity: next } : r))
    );
  }

  function onStockInput(id, raw) {
    if (raw === "") {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, stock_quantity: "" } : r))
      );
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    updateStock(id, Math.max(0, parsed));
  }

  async function saveStock(row) {
    const quantity = Math.max(0, Number(row.stock_quantity || 0));
    setSavingId(row.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("producer_products")
      .update({
        stock_quantity: quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setSavingId("");
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, stock_quantity: quantity } : r
      )
    );
    setSavedMap((prev) => ({ ...prev, [row.id]: quantity }));
    showToast("Stok güncellendi");
  }

  const totalStock = rows.reduce(
    (sum, r) => sum + Number(r.stock_quantity || 0),
    0
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Ürünlerim</h1>
        <p className="text-zinc-500">Ürettiğiniz ürünler ve stok adediniz</p>
      </div>

      <div className="rounded-2xl bg-orange-600 px-5 py-4 text-white">
        <p className="text-sm opacity-90">Toplam Stoğunuz</p>
        <p className="text-3xl font-bold">{totalStock} adet</p>
      </div>

      {loading ? (
        <p className="text-lg text-zinc-500">Yükleniyor...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-base text-zinc-500">
          Admin henüz size ürün ataması yapmadı
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const dirty = isDirty(row);
            return (
              <div
                key={row.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (row.products?.image_url) {
                        setPreviewUrl(row.products.image_url);
                      }
                    }}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100"
                    aria-label="Ürün görselini büyüt"
                  >
                    {row.products?.image_url ? (
                      <Image
                        src={row.products.image_url}
                        alt={row.products.title || "Ürün"}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                        Yok
                      </div>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug text-zinc-900">
                      {row.products?.title || "Ürün"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {row.products?.brand_name || "Ontic"}
                    </p>
                    {row.products?.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                        {truncate(row.products.description, 140)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
                  <span className="text-sm font-medium text-zinc-500">Stok</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateStock(
                        row.id,
                        Math.max(0, Number(row.stock_quantity || 0) - 1)
                      )
                    }
                    className="h-11 w-11 rounded-xl border border-zinc-300 text-lg font-semibold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={row.stock_quantity}
                    onChange={(e) => onStockInput(row.id, e.target.value)}
                    className="h-11 w-20 rounded-xl border border-zinc-300 text-center text-base font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateStock(row.id, Number(row.stock_quantity || 0) + 1)
                    }
                    className="h-11 w-11 rounded-xl border border-zinc-300 text-lg font-semibold"
                  >
                    +
                  </button>
                  {dirty ? (
                    <button
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => saveStock(row)}
                      className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {savingId === row.id ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ImageLightbox src={previewUrl} onClose={() => setPreviewUrl("")} />

      {toast ? (
        <div
          className={`fixed bottom-24 left-1/2 z-[60] w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm font-medium shadow-lg sm:bottom-6 ${
            toast.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-zinc-900 text-white"
          }`}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
