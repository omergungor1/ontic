"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, PRODUCER_ORDER_STATUS } from "@/lib/format";

const FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "created", label: "Oluşturuldu" },
  { key: "confirmed", label: "Onaylandı" },
  { key: "ready", label: "Hazır" },
  { key: "shipped", label: "Kargolandı" },
  { key: "completed", label: "Tamamlandı" },
  { key: "cancelled", label: "İptal" },
  { key: "rejected", label: "Reddedildi" },
];

function statusClass(status) {
  switch (status) {
    case "created":
      return "bg-amber-100 text-amber-700";
    case "confirmed":
      return "bg-sky-100 text-sky-700";
    case "ready":
      return "bg-indigo-100 text-indigo-700";
    case "shipped":
      return "bg-teal-100 text-teal-700";
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "cancelled":
    case "rejected":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export default function AdminProducerOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [cargoPreviewUrl, setCargoPreviewUrl] = useState("");

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("producer_orders")
      .select(
        "*, profiles!producer_id(full_name, username, phone), trendyol_orders!trendyol_order_id(id, order_number, customer_first_name, customer_last_name), producer_order_items(*, products!product_id(id, title, image_url))"
      )
      .order("created_at", { ascending: false })
      .limit(300);
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const filtered = useMemo(() => {
    let list = orders;
    if (filter !== "all") list = list.filter((o) => o.status === filter);
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((o) => {
        return (
          o.profiles?.full_name?.toLowerCase().includes(term) ||
          o.profiles?.username?.toLowerCase().includes(term) ||
          o.trendyol_orders?.order_number?.toLowerCase().includes(term)
        );
      });
    }
    return list;
  }, [orders, filter, search]);

  const selectedItems = selected?.producer_order_items || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Üretici Siparişleri</h1>
        <p className="text-zinc-500">
          Üreticilere dağıtılan tüm alt siparişler
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === f.key
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-zinc-50 text-zinc-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Üretici veya sipariş no ara"
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Kayıt bulunamadı
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Üretici</th>
                  <th className="whitespace-nowrap px-4 py-3">Sipariş No</th>
                  <th className="whitespace-nowrap px-4 py-3">Tarih</th>
                  <th className="whitespace-nowrap px-4 py-3">Kazanç</th>
                  <th className="whitespace-nowrap px-4 py-3">Durum</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => setSelected(po)}
                    className="cursor-pointer border-t border-zinc-100 hover:bg-orange-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-medium">{po.profiles?.full_name}</p>
                      <p className="text-xs text-zinc-500">
                        @{po.profiles?.username}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {po.trendyol_orders ? (
                        <Link
                          href={`/admin/siparisler/${po.trendyol_orders.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-orange-600 hover:underline"
                        >
                          {po.trendyol_orders.order_number}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {formatDate(po.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatPrice(po.producer_earning)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                          po.status
                        )}`}
                      >
                        {PRODUCER_ORDER_STATUS[po.status] || po.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="producer-order-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4">
              <div className="min-w-0">
                <h3
                  id="producer-order-detail-title"
                  className="text-lg font-semibold"
                >
                  Üretici Sipariş Detayı
                </h3>
                <p className="mt-0.5 truncate text-sm text-zinc-500">
                  {selected.trendyol_orders?.order_number || "Sipariş"} ·{" "}
                  {selected.profiles?.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full px-2 py-1 text-xl leading-none text-zinc-400 hover:bg-zinc-100"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-500">Durum</p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                      selected.status
                    )}`}
                  >
                    {PRODUCER_ORDER_STATUS[selected.status] || selected.status}
                  </span>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-500">Kazanç</p>
                  <p className="mt-1 text-base font-semibold text-emerald-600">
                    {formatPrice(selected.producer_earning)}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-500">Tarih</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(selected.created_at)}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-500">Üretici</p>
                  <p className="mt-1 truncate text-sm font-medium">
                    @{selected.profiles?.username || "-"}
                  </p>
                  {selected.profiles?.phone ? (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {selected.profiles.phone}
                    </p>
                  ) : null}
                </div>
              </div>

              {selected.trendyol_orders ? (
                <div className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-xs text-zinc-500">Ana sipariş</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {selected.trendyol_orders.customer_first_name}{" "}
                      {selected.trendyol_orders.customer_last_name}
                    </p>
                    <Link
                      href={`/admin/siparisler/${selected.trendyol_orders.id}`}
                      className="text-sm font-medium text-orange-600 hover:underline"
                    >
                      {selected.trendyol_orders.order_number}
                    </Link>
                  </div>
                </div>
              ) : null}

              <div>
                <h4 className="mb-2 text-sm font-semibold">Ürünler</h4>
                {selectedItems.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
                    Ürün kalemi yok
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                          {item.products?.image_url ? (
                            <Image
                              src={item.products.image_url}
                              alt={item.products.title || "Ürün"}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                              Yok
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.products?.title || "Ürün"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {item.quantity} adet · birim{" "}
                            {formatPrice(item.unit_earning)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatPrice(
                            Number(item.unit_earning || 0) *
                              Number(item.quantity || 0)
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.cargo_image_url ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Kargo kodu</h4>
                  <button
                    type="button"
                    onClick={() => setCargoPreviewUrl(selected.cargo_image_url)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left text-sm font-medium text-orange-700 hover:bg-zinc-100"
                  >
                    Kargo kodunu görüntüle
                  </button>
                </div>
              ) : null}

              {selected.notes ? (
                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="text-xs font-medium text-amber-700">Not</p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        src={cargoPreviewUrl}
        alt="Kargo kodu"
        onClose={() => setCargoPreviewUrl("")}
      />
    </div>
  );
}
