"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice } from "@/lib/format";
import { PAYABLE_PRODUCER_ORDER_STATUSES } from "@/lib/producer-orders";

const PAGE_SIZE = 20;

function mergeAndSort(sales, payments, stars) {
  const items = [
    ...sales.map((s) => ({
      type: "sale",
      id: `sale-${s.id}`,
      date: s.shipped_at,
      amount: Number(s.producer_earning || 0),
      materialSupport: Number(s.material_support || 0),
    })),
    ...payments.map((p) => ({
      type: p.kind === "campaign" ? "campaign" : "payment",
      id: `payment-${p.id}`,
      date: p.paid_at,
      amount: Number(p.amount || 0),
      note: p.note,
    })),
    ...stars.map((s) => ({
      type: "star",
      id: `star-${s.id}`,
      date: s.created_at,
      amount: Number(s.amount || 0),
      note: s.note,
    })),
  ];
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
}

export default function ProducerPaymentsPage() {
  const [balance, setBalance] = useState(0);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [userId, setUserId] = useState(null);
  const salesOffset = useRef(0);
  const paymentsOffset = useRef(0);
  const starsOffset = useRef(0);
  const hasMoreSales = useRef(true);
  const hasMorePayments = useRef(true);
  const hasMoreStars = useRef(true);
  const loadingRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef(null);

  const fetchBatch = useCallback(async (uid) => {
    const supabase = createClient();
    const salesFrom = salesOffset.current;
    const paymentsFrom = paymentsOffset.current;
    const starsFrom = starsOffset.current;

    const [salesRes, paymentsRes, starsRes] = await Promise.all([
      hasMoreSales.current
        ? supabase
            .from("producer_orders")
            .select("id, shipped_at, producer_earning, material_support")
            .eq("producer_id", uid)
            .in("status", PAYABLE_PRODUCER_ORDER_STATUSES)
            .order("shipped_at", { ascending: false, nullsFirst: false })
            .range(salesFrom, salesFrom + PAGE_SIZE - 1)
        : Promise.resolve({ data: [] }),
      hasMorePayments.current
        ? supabase
            .from("payments")
            .select("id, paid_at, amount, note, kind")
            .eq("producer_id", uid)
            .order("paid_at", { ascending: false })
            .range(paymentsFrom, paymentsFrom + PAGE_SIZE - 1)
        : Promise.resolve({ data: [] }),
      hasMoreStars.current
        ? supabase
            .from("star_bonus_entries")
            .select("id, created_at, amount, note, entry_type")
            .eq("producer_id", uid)
            .order("created_at", { ascending: false })
            .range(starsFrom, starsFrom + PAGE_SIZE - 1)
        : Promise.resolve({ data: [] }),
    ]);

    const sales = salesRes.data || [];
    const payments = paymentsRes.data || [];
    const stars = starsRes.data || [];

    salesOffset.current = salesFrom + sales.length;
    paymentsOffset.current = paymentsFrom + payments.length;
    starsOffset.current = starsFrom + stars.length;
    hasMoreSales.current = sales.length === PAGE_SIZE;
    hasMorePayments.current = payments.length === PAGE_SIZE;
    hasMoreStars.current = stars.length === PAGE_SIZE;
    setHasMore(
      hasMoreSales.current || hasMorePayments.current || hasMoreStars.current
    );

    return mergeAndSort(sales, payments, stars);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      loadingRef.current = true;
      setLoading(true);
      salesOffset.current = 0;
      paymentsOffset.current = 0;
      starsOffset.current = 0;
      hasMoreSales.current = true;
      hasMorePayments.current = true;
      hasMoreStars.current = true;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        loadingRef.current = false;
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const [{ data: earningRows }, { data: paymentRows }, { data: starRows }] =
        await Promise.all([
        supabase
          .from("producer_orders")
          .select("producer_earning, material_support")
          .eq("producer_id", user.id)
          .in("status", PAYABLE_PRODUCER_ORDER_STATUSES),
        supabase
          .from("payments")
          .select("amount, kind")
          .eq("producer_id", user.id),
        supabase
          .from("star_bonus_entries")
          .select("amount")
          .eq("producer_id", user.id),
      ]);
      if (cancelled) return;

      const totalEarned = (earningRows || []).reduce(
        (sum, r) =>
          sum +
          Number(r.producer_earning || 0) +
          Number(r.material_support || 0),
        0
      );
      const totalPaid = (paymentRows || []).reduce((sum, r) => {
        if (r.kind === "campaign") return sum;
        return sum + Number(r.amount || 0);
      }, 0);
      const starBonus = (starRows || []).reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      );
      setBalance(totalEarned + starBonus - totalPaid);

      const batch = await fetchBatch(user.id);
      if (cancelled) return;

      setTimeline(batch);
      loadingRef.current = false;
      setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [fetchBatch]);

  const loadMore = useCallback(async () => {
    if (
      loadingRef.current ||
      loadingMoreRef.current ||
      !userId ||
      (!hasMoreSales.current &&
        !hasMorePayments.current &&
        !hasMoreStars.current)
    ) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const batch = await fetchBatch(userId);
      if (!batch.length) return;
      setTimeline((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const next = [...prev];
        for (const entry of batch) {
          if (!seen.has(entry.id)) next.push(entry);
        }
        next.sort((a, b) => new Date(b.date) - new Date(a.date));
        return next;
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchBatch, userId]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || loading || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, hasMore, loadMore, timeline.length]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ödemelerim</h1>
        <p className="text-zinc-500">Alacak bakiyeniz ve işlem geçmişi</p>
      </div>

      <div className="rounded-2xl bg-orange-600 px-5 py-6 text-center text-white">
        <p className="text-sm opacity-90">Kalan Alacağınız</p>
        <p className="mt-1 text-4xl font-bold">{formatPrice(balance)}</p>
      </div>

      {loading ? (
        <p className="text-lg text-zinc-500">Yükleniyor...</p>
      ) : timeline.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-base text-zinc-500">
          Henüz işlem kaydı yok
        </p>
      ) : (
        <div className="space-y-2">
          {timeline.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="text-base font-medium">
                  {entry.type === "sale"
                    ? "Satış"
                    : entry.type === "campaign"
                      ? "Kampanya Ödülü"
                      : entry.type === "star"
                        ? "Yıldızlı ürün bonusu"
                        : "Ödeme Aldınız"}
                </p>
                <p className="text-sm text-zinc-500">
                  {formatDate(entry.date)}
                  {entry.note ? ` · ${entry.note}` : ""}
                </p>
                {entry.type === "sale" &&
                Number(entry.materialSupport || 0) > 0 ? (
                  <p className="mt-1 text-sm font-medium text-sky-700">
                    +{formatPrice(entry.materialSupport)} malzeme desteği
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-lg font-semibold ${
                    entry.type === "payment"
                      ? "text-sky-600"
                      : Number(
                            entry.type === "sale"
                              ? Number(entry.amount || 0) +
                                  Number(entry.materialSupport || 0)
                              : entry.amount
                          ) < 0
                        ? "text-rose-600"
                        : "text-emerald-600"
                  }`}
                >
                  {formatPrice(
                    entry.type === "sale"
                      ? Number(entry.amount || 0) +
                          Number(entry.materialSupport || 0)
                      : entry.amount
                  )}
                </p>
                {entry.type === "sale" &&
                Number(entry.materialSupport || 0) > 0 ? (
                  <p className="text-xs text-zinc-500">
                    Üretim {formatPrice(entry.amount)}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />
      {loadingMore ? (
        <p className="text-center text-sm text-zinc-400">Yükleniyor...</p>
      ) : null}
    </div>
  );
}
