"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, PRODUCER_ORDER_STATUS } from "@/lib/format";
import { useUnreadMessages } from "@/lib/useUnreadMessages";

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
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export default function ProducerHomePage() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState([]);
  const [totalStock, setTotalStock] = useState(0);
  const [remainingPayment, setRemainingPayment] = useState(0);
  const [fullName, setFullName] = useState("");
  const { unreadCount } = useUnreadMessages({
    role: "producer",
    clearOnPath: "/uretici/mesajlar",
    pathname,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      setFullName(profile?.full_name || "");

      const { data: orders } = await supabase
        .from("producer_orders")
        .select(
          "*, producer_order_items(*, products!product_id(title)), trendyol_orders!trendyol_order_id(order_number, customer_first_name, customer_last_name)"
        )
        .eq("producer_id", user.id)
        .not("status", "in", '("completed","cancelled","shipped")')
        .order("created_at", { ascending: false });

      const { data: stockRows } = await supabase
        .from("producer_products")
        .select("stock_quantity")
        .eq("producer_id", user.id)
        .eq("is_active", true);

      const stockSum = (stockRows || []).reduce(
        (sum, r) => sum + Number(r.stock_quantity || 0),
        0
      );

      const { data: earningRows } = await supabase
        .from("producer_orders")
        .select("producer_earning")
        .eq("producer_id", user.id)
        .neq("status", "cancelled");

      const { data: paymentRows } = await supabase
        .from("payments")
        .select("amount")
        .eq("producer_id", user.id);

      const totalEarned = (earningRows || []).reduce(
        (sum, r) => sum + Number(r.producer_earning || 0),
        0
      );
      const totalPaid = (paymentRows || []).reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      );

      setActiveOrders(orders || []);
      setTotalStock(stockSum);
      setRemainingPayment(totalEarned - totalPaid);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-lg text-zinc-500">Yükleniyor...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Merhaba{fullName ? `, ${fullName}` : ""} 👋</h1>
        <p className="text-zinc-500">Ontic üretici paneline hoş geldiniz</p>
      </div>

      {unreadCount > 0 ? (
        <Link
          href="/uretici/mesajlar"
          className="flex items-center justify-between rounded-2xl bg-rose-600 px-5 py-4 text-white"
        >
          <span className="text-base font-semibold">
            {unreadCount} okunmamış mesajınız var
          </span>
          <span className="text-2xl">→</span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/uretici/urunler"
          className="rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <p className="text-sm text-zinc-500">Toplam Stok</p>
          <p className="mt-2 text-3xl font-bold">{totalStock}</p>
          <p className="mt-1 text-sm text-zinc-400">adet</p>
        </Link>
        <Link
          href="/uretici/odemeler"
          className="rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <p className="text-sm text-zinc-500">Kalan Ödeme</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {formatPrice(remainingPayment)}
          </p>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Aktif Siparişlerim</h2>
        {activeOrders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-base text-zinc-500">
            Aktif siparişiniz bulunmuyor
          </p>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <Link
                key={order.id}
                href={`/uretici/siparisler/${order.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4"
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
                <p className="mt-1 text-sm text-zinc-500">
                  {(order.producer_order_items || [])
                    .map((i) => `${i.products?.title || "Ürün"} × ${i.quantity}`)
                    .join(", ")}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">
                    {formatDate(order.created_at)}
                  </span>
                  <span className="font-semibold text-emerald-600">
                    {formatPrice(order.producer_earning)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
