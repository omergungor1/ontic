"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("producer_orders")
      .select(
        "*, profiles!producer_id(full_name, username), trendyol_orders!trendyol_order_id(id, order_number, customer_first_name, customer_last_name)"
      )
      .order("created_at", { ascending: false })
      .limit(300);
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
                  <tr key={po.id} className="border-t border-zinc-100">
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
    </div>
  );
}
