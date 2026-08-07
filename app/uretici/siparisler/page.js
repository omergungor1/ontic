"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, PRODUCER_ORDER_STATUS } from "@/lib/format";

const PAGE_SIZE = 20;

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

function mergeUnique(prev, next) {
  const seen = new Set(prev.map((o) => o.id));
  const merged = [...prev];
  for (const order of next) {
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    merged.push(order);
  }
  return merged;
}

export default function ProducerOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const userIdRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const ordersLenRef = useRef(0);
  const sentinelRef = useRef(null);

  const loadPage = useCallback(async (offset) => {
    const supabase = createClient();
    let uid = userIdRef.current;
    if (!uid) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      uid = user?.id || null;
      userIdRef.current = uid;
    }
    if (!uid) return [];

    const { data } = await supabase
      .from("producer_orders")
      .select(
        "*, producer_order_items(*, products!product_id(title)), trendyol_orders!trendyol_order_id(order_number, customer_first_name, customer_last_name)"
      )
      .eq("producer_id", uid)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    return data || [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      const first = await loadPage(0);
      if (cancelled) return;
      setOrders(first);
      ordersLenRef.current = first.length;
      const more = first.length === PAGE_SIZE;
      setHasMore(more);
      hasMoreRef.current = more;
      setLoading(false);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    const next = await loadPage(ordersLenRef.current);
    setOrders((prev) => {
      const merged = mergeUnique(prev, next);
      ordersLenRef.current = merged.length;
      return merged;
    });
    const more = next.length === PAGE_SIZE;
    setHasMore(more);
    hasMoreRef.current = more;

    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, [loadPage]);

  useEffect(() => {
    if (loading) return undefined;
    const el = sentinelRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadMore]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Siparişlerim</h1>
        <p className="text-zinc-500">Size dağıtılan tüm siparişler</p>
      </div>

      {loading ? (
        <p className="text-lg text-zinc-500">Yükleniyor...</p>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-base text-zinc-500">
          Henüz siparişiniz yok
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const lines = order.producer_order_items || [];
            const shortageCount = lines.filter(
              (i) => Number(i.stock_at_assignment) < Number(i.quantity)
            ).length;
            return (
              <Link
                key={order.id}
                href={`/uretici/siparisler/${order.id}`}
                className={`block rounded-2xl border bg-white p-4 ${
                  shortageCount > 0 ? "border-rose-200" : "border-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {order.trendyol_orders?.order_number || "Sipariş"}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                      order.status
                    )}`}
                  >
                    {PRODUCER_ORDER_STATUS[order.status] || order.status}
                  </span>
                </div>

                <ul className="mt-3 space-y-2">
                  {lines.map((item) => {
                    const qty = Number(item.quantity || 0);
                    const stock = Number(item.stock_at_assignment ?? 0);
                    const shortage = stock < qty;
                    const missing = Math.max(0, qty - stock);
                    return (
                      <li
                        key={item.id}
                        className={`rounded-xl px-3 py-2.5 ${
                          shortage ? "bg-rose-50" : "bg-zinc-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-zinc-800">
                            {item.products?.title || "Ürün"}
                          </p>
                          <p className="shrink-0 text-base font-bold tabular-nums text-zinc-900">
                            {qty}{" "}
                            <span className="text-xs font-semibold text-zinc-500">
                              adet
                            </span>
                          </p>
                        </div>
                        <div
                          className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium ${
                            shortage ? "text-rose-700" : "text-emerald-700"
                          }`}
                        >
                          <span>Stok: {stock} adet</span>
                          {shortage ? (
                            <span className="rounded-md bg-rose-100 px-1.5 py-0.5 font-semibold">
                              {missing} eksik
                            </span>
                          ) : (
                            <span>Yeterli</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {shortageCount > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-rose-700">
                    {shortageCount} üründe stok eksik
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">
                    {formatDate(order.created_at)}
                  </span>
                  <span className="font-semibold text-emerald-600">
                    {formatPrice(order.producer_earning)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && orders.length > 0 ? (
        <div ref={sentinelRef} className="h-4" />
      ) : null}
      {loadingMore ? (
        <p className="text-center text-sm text-zinc-400">Yükleniyor...</p>
      ) : null}
      {!hasMore && orders.length > 0 ? (
        <p className="text-center text-sm text-zinc-400">
          Tüm siparişler yüklendi
        </p>
      ) : null}
    </div>
  );
}
