"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AdminHomePage() {
  const [stats, setStats] = useState({
    products: 0,
    producers: 0,
    pendingOrders: 0,
    activeProducerOrders: 0,
  });
  const [syncing, setSyncing] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        { count: products },
        { count: producers },
        { count: pendingOrders },
        { count: activeProducerOrders },
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "producer"),
        supabase
          .from("trendyol_orders")
          .select("*", { count: "exact", head: true })
          .in("internal_status", ["pending_assignment", "partially_assigned"]),
        supabase
          .from("producer_orders")
          .select("*", { count: "exact", head: true })
          .not("status", "in", '("completed","cancelled","rejected")'),
      ]);

      setStats({
        products: products || 0,
        producers: producers || 0,
        pendingOrders: pendingOrders || 0,
        activeProducerOrders: activeProducerOrders || 0,
      });
    }
    load();
  }, []);

  async function sync(type) {
    setSyncing(type);
    setMessage("");
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, days: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync başarısız");
      setMessage(
        type === "products"
          ? `${data.synced} ürün senkronlandı`
          : `${data.synced} sipariş senkronlandı`
      );
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSyncing("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Yönetim Özeti</h1>
        <p className="text-zinc-500">Hızlı bakış ve senkronizasyon</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Aktif ürün" value={stats.products} href="/admin/urunler" />
        <Stat label="Üretici" value={stats.producers} href="/admin/ureticiler" />
        <Stat
          label="Dağıtılacak sipariş"
          value={stats.pendingOrders}
          href="/admin/siparisler"
        />
        <Stat
          label="Aktif üretici siparişi"
          value={stats.activeProducerOrders}
          href="/admin/uretici-siparisler"
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Trendyol Senkron</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Ürün ve siparişleri Trendyol API’den çekip veritabanına yazar.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={Boolean(syncing)}
            onClick={() => sync("products")}
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {syncing === "products" ? "Ürünler çekiliyor..." : "Ürünleri Sync Et"}
          </button>
          <button
            type="button"
            disabled={Boolean(syncing)}
            onClick={() => sync("orders")}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {syncing === "orders"
              ? "Siparişler çekiliyor..."
              : "Siparişleri Sync Et (30 gün)"}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
      </div>
    </div>
  );
}

function Stat({ label, value, href }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-orange-300"
    >
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </Link>
  );
}
