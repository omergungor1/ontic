"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminStockPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState("");

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("producer_products")
      .select(
        "id, stock_quantity, product_id, profiles!producer_id(id, full_name, username), products!product_id(id, title, image_url, brand_name)"
      )
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .order("stock_quantity", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const products = useMemo(() => {
    const map = new Map();

    for (const row of rows) {
      const qty = Number(row.stock_quantity || 0);
      if (qty <= 0) continue;
      const product = row.products;
      const productId = row.product_id || product?.id;
      if (!productId) continue;

      if (!map.has(productId)) {
        map.set(productId, {
          id: productId,
          title: product?.title || "Ürün",
          image_url: product?.image_url || null,
          brand_name: product?.brand_name || null,
          totalStock: 0,
          producers: [],
        });
      }

      const entry = map.get(productId);
      entry.totalStock += qty;
      if (row.profiles?.id) {
        entry.producers.push({
          id: row.profiles.id,
          full_name: row.profiles.full_name,
          username: row.profiles.username,
          stock_quantity: qty,
          rowId: row.id,
        });
      }
    }

    for (const entry of map.values()) {
      entry.producers.sort(
        (a, b) => Number(b.stock_quantity) - Number(a.stock_quantity)
      );
    }

    return Array.from(map.values()).sort(
      (a, b) => Number(b.totalStock) - Number(a.totalStock)
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => {
      const inTitle = product.title?.toLowerCase().includes(term);
      const inBrand = product.brand_name?.toLowerCase().includes(term);
      const inProducer = product.producers.some(
        (p) =>
          p.full_name?.toLowerCase().includes(term) ||
          p.username?.toLowerCase().includes(term)
      );
      return inTitle || inBrand || inProducer;
    });
  }, [products, search]);

  const totalStock = filtered.reduce(
    (sum, p) => sum + Number(p.totalStock || 0),
    0
  );

  function toggleOpen(productId) {
    setOpenId((prev) => (prev === productId ? "" : productId));
  }

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Stok Takip</h1>
          <p className="text-zinc-500">
            Stoğu olan ürünler ve üretici dağılımı
          </p>
        </div>
        <div className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm sm:w-auto">
          Toplam stok: <span className="font-semibold">{totalStock}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ürün veya üretici ara"
          className="w-full max-w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Stoğu olan ürün bulunamadı
        </p>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => {
            const open = openId === product.id;
            return (
              <article
                key={product.id}
                className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white"
              >
                <div className="relative aspect-[4/3] bg-zinc-100">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.title}
                      fill
                      className="object-cover"
                      sizes="(max-width:768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                      Görsel yok
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="font-semibold leading-snug">
                      {product.title}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {product.brand_name || "Ontic"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleOpen(product.id)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between rounded-xl bg-zinc-50 px-3 py-3 text-left transition hover:bg-zinc-100"
                  >
                    <div>
                      <p className="text-xs font-medium text-zinc-500">
                        Toplam stok
                      </p>
                      <p className="mt-0.5 text-lg font-semibold text-zinc-900">
                        {product.totalStock} adet
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {product.producers.length} üreticide stok var
                      </p>
                    </div>
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition ${
                        open ? "rotate-180" : ""
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth="2"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  {open ? (
                    <div className="space-y-2 border-t border-zinc-100 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Stoğu olan üreticiler
                      </p>
                      {product.producers.map((producer) => (
                        <div
                          key={`${product.id}-${producer.id}-${producer.rowId}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {producer.full_name}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              @{producer.username}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {producer.stock_quantity} adet
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
