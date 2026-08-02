"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminStockPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("producer_products")
      .select(
        "*, profiles!producer_id(full_name, username), products!product_id(title, image_url)"
      )
      .eq("is_active", true)
      .order("stock_quantity", { ascending: true });
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.profiles?.full_name?.toLowerCase().includes(term) ||
        r.products?.title?.toLowerCase().includes(term)
    );
  }, [rows, search]);

  const totalStock = filtered.reduce(
    (sum, r) => sum + Number(r.stock_quantity || 0),
    0
  );

  function updateLocal(id, value) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, stock_quantity: value } : r))
    );
  }

  async function saveStock(row) {
    setSavingId(row.id);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("producer_products")
      .update({
        stock_quantity: Number(row.stock_quantity || 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setSavingId("");
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Stok güncellendi");
    }
  }

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Stok Takip</h1>
          <p className="text-zinc-500">Üretici bazlı stok görünümü</p>
        </div>
        <div className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm sm:w-auto">
          Toplam stok: <span className="font-semibold">{totalStock}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Üretici veya ürün ara"
          className="w-full max-w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {message ? <p className="text-sm text-zinc-600">{message}</p> : null}

      {loading ? (
        <p>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Kayıt bulunamadı
        </p>
      ) : (
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <div
              key={row.id}
              className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                  {row.products?.image_url ? (
                    <Image
                      src={row.products.image_url}
                      alt={row.products.title || "Ürün"}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">
                    {row.products?.title}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {row.profiles?.full_name} · @{row.profiles?.username}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex min-w-0 items-center gap-2">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={row.stock_quantity}
                  onChange={(e) => updateLocal(row.id, e.target.value)}
                  className="w-0 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-center text-sm"
                />
                <button
                  type="button"
                  disabled={savingId === row.id}
                  onClick={() => saveStock(row)}
                  className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {savingId === row.id ? "..." : "Kaydet"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
