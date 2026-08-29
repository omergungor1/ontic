"use client";

import StorageImage from "@/components/StorageImage";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, truncate } from "@/lib/format";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [savingPriceId, setSavingPriceId] = useState(null);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    title: "",
    description: "",
    salePrice: "",
    producerPrice: "",
    stockCode: "",
  });

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*, product_variants(*)")
      .order("updated_at", { ascending: false });
    const list = data || [];
    setProducts(list);
    setPriceDrafts(
      Object.fromEntries(
        list.map((p) => [
          p.id,
          p.producer_price != null && p.producer_price !== ""
            ? String(p.producer_price)
            : "",
        ])
      )
    );
    setLoading(false);
  }

  async function saveProducerPrice(product) {
    const raw = priceDrafts[product.id];
    const value = Number(raw === "" || raw == null ? 0 : raw);
    if (Number.isNaN(value) || value < 0) {
      setMessage("Geçerli bir üretici fiyatı girin");
      return;
    }
    setSavingPriceId(product.id);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({
        producer_price: value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`"${product.title}" üretici fiyatı güncellendi`);
      await load();
    }
    setSavingPriceId(null);
  }

  useEffect(() => {
    load();
  }, []);

  async function syncProducts() {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "products" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`${data.synced} ürün senkronlandı`);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function toggleActive(product) {
    const supabase = createClient();
    await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    await load();
  }

  async function addManual(e) {
    e.preventDefault();
    const supabase = createClient();
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        title: manual.title,
        description: manual.description,
        is_manual: true,
        is_active: true,
        image_url: null,
        images: [],
        producer_price: Number(manual.producerPrice || 0),
      })
      .select("id")
      .single();
    if (error) {
      setMessage(error.message);
      return;
    }
    await supabase.from("product_variants").insert({
      product_id: product.id,
      barcode: `MANUAL-${Date.now()}`,
      stock_code: manual.stockCode || null,
      sale_price: Number(manual.salePrice || 0),
      list_price: Number(manual.salePrice || 0),
      on_sale: true,
    });
    setManualOpen(false);
    setManual({
      title: "",
      description: "",
      salePrice: "",
      producerPrice: "",
      stockCode: "",
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ürünler</h1>
          <p className="text-zinc-500">Trendyol sync ve manuel ürün ekleme</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
          >
            Manuel ürün ekle
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={syncProducts}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {syncing ? "Sync..." : "Trendyol Sync"}
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const variant = product.product_variants?.[0];
            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
              >
                <div className="relative aspect-[4/3] bg-zinc-100">
                  {product.image_url ? (
                    <StorageImage
                      src={product.image_url}
                      alt={product.title}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-snug">{product.title}</h2>
                    <button
                      type="button"
                      onClick={() => toggleActive(product)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        product.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {product.is_active ? "Aktif" : "Pasif"}
                    </button>
                  </div>
                  <p className="text-sm text-zinc-600">
                    {truncate(product.description, 100)}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span>Satış: {formatPrice(variant?.sale_price)}</span>
                    <span className="text-zinc-500">
                      {product.brand_name || "Manuel"}
                    </span>
                  </div>
                  <div className="space-y-1.5 rounded-xl bg-zinc-50 p-3">
                    <label className="block text-xs font-medium text-zinc-600">
                      Üretici fiyatı (sabit) ₺
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={priceDrafts[product.id] ?? ""}
                        onChange={(e) =>
                          setPriceDrafts((prev) => ({
                            ...prev,
                            [product.id]: e.target.value,
                          }))
                        }
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        disabled={savingPriceId === product.id}
                        onClick={() => saveProducerPrice(product)}
                        className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {savingPriceId === product.id ? "..." : "Kaydet"}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Tüm üreticiler için aynı. Siparişe atama anında kilitlenir.
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {manualOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={addManual}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5"
          >
            <h3 className="text-lg font-semibold">Manuel ürün</h3>
            <input
              required
              placeholder="Ürün adı"
              value={manual.title}
              onChange={(e) =>
                setManual((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <textarea
              placeholder="Açıklama"
              value={manual.description}
              onChange={(e) =>
                setManual((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <input
              placeholder="Satış fiyatı"
              value={manual.salePrice}
              onChange={(e) =>
                setManual((prev) => ({ ...prev, salePrice: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="Üretici fiyatı (sabit) ₺"
              value={manual.producerPrice}
              onChange={(e) =>
                setManual((prev) => ({
                  ...prev,
                  producerPrice: e.target.value,
                }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <input
              placeholder="Stok kodu"
              value={manual.stockCode}
              onChange={(e) =>
                setManual((prev) => ({ ...prev, stockCode: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="flex-1 rounded-xl border py-2"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-orange-600 py-2 text-white"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
