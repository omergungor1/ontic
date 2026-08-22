"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImageLightbox from "@/components/ImageLightbox";
import { formatDate, formatPrice, PRODUCER_ORDER_STATUS } from "@/lib/format";

// Kargolama sonrası görev biter; doğrudan completed olur
const STATUS_FLOW = ["created", "confirmed", "ready", "completed"];
const STOCK_INFO_STATUSES = ["created", "confirmed", "ready"];

const NEXT_ACTION_LABEL = {
  created: "Siparişi Onayla",
  confirmed: "Hazır Olarak İşaretle",
  ready: "Kargolandı Olarak İşaretle",
};

export default function ProducerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [stockByProductId, setStockByProductId] = useState({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [cargoPreviewOpen, setCargoPreviewOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  async function load() {
    if (!orderId) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("producer_orders")
      .select(
        "*, producer_order_items(*, products!product_id(title, image_url)), trendyol_orders!trendyol_order_id(order_number, customer_first_name, customer_last_name, shipment_address)"
      )
      .eq("id", orderId)
      .maybeSingle();
    setOrder(data || null);
    const lineItems = data?.producer_order_items || [];
    setItems(lineItems);

    if (data?.producer_id && lineItems.length) {
      const productIds = [
        ...new Set(lineItems.map((i) => i.product_id).filter(Boolean)),
      ];
      if (productIds.length) {
        const { data: stockRows } = await supabase
          .from("producer_products")
          .select("product_id, stock_quantity")
          .eq("producer_id", data.producer_id)
          .in("product_id", productIds);
        setStockByProductId(
          Object.fromEntries(
            (stockRows || []).map((r) => [
              r.product_id,
              Number(r.stock_quantity || 0),
            ])
          )
        );
      } else {
        setStockByProductId({});
      }
    } else {
      setStockByProductId({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function updateStatus(status) {
    setUpdating(true);
    setMessage("");
    try {
      const res = await fetch(`/api/producer-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function rejectOrder() {
    setUpdating(true);
    setMessage("");
    try {
      const res = await fetch(`/api/producer-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reddedilemedi");
      setRejectOpen(false);
      await load();
    } catch (err) {
      setMessage(err.message);
      setRejectOpen(false);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <p className="text-lg text-zinc-500">Yükleniyor...</p>;
  if (!order)
    return (
      <div>
        <p className="text-lg">Sipariş bulunamadı.</p>
        <Link href="/uretici/siparisler" className="text-orange-600">
          Siparişlerime dön
        </Link>
      </div>
    );

  const currentIndex = STATUS_FLOW.indexOf(order.status);
  const nextStatus =
    currentIndex >= 0 && currentIndex + 1 < STATUS_FLOW.length
      ? STATUS_FLOW[currentIndex + 1]
      : null;
  const isFinished =
    order.status === "completed" || order.status === "shipped";
  const showStockInfo = STOCK_INFO_STATUSES.includes(order.status);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push("/uretici/siparisler")}
        aria-label="Siparişlerime dön"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm active:bg-zinc-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div>
        <h1 className="text-2xl font-semibold">
          {order.trendyol_orders?.order_number || "Sipariş"}
        </h1>
        <p className="text-zinc-500">
          {order.trendyol_orders?.customer_first_name}{" "}
          {order.trendyol_orders?.customer_last_name} ·{" "}
          {formatDate(order.created_at)}
        </p>
      </div>

      {order.status === "cancelled" || order.status === "rejected" ? (
        <div className="rounded-2xl bg-rose-50 px-5 py-4 text-center">
          <p className="text-base font-semibold text-rose-700">
            {order.status === "rejected"
              ? "Bu siparişi reddettiniz"
              : "Bu sipariş iptal edildi"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-emerald-600 px-5 py-4 text-white">
          <p className="text-sm opacity-90">Bu siparişten kazancınız</p>
          <p className="text-3xl font-bold">
            {formatPrice(order.producer_earning)}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Ürünler</h2>
        {items.map((item) => {
          const qty = Number(item.quantity || 0);
          const currentStock = Number(stockByProductId[item.product_id] ?? 0);
          const shortage = showStockInfo && currentStock < qty;
          const missing = Math.max(0, qty - currentStock);
          return (
            <div
              key={item.id}
              className={`rounded-2xl border bg-white p-4 ${
                shortage ? "border-rose-200" : "border-zinc-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                  {item.products?.image_url ? (
                    <Image
                      src={item.products.image_url}
                      alt={item.products.title}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium leading-snug">
                    {item.products?.title || "Ürün"}
                  </p>
                  <p className="mt-1 text-lg font-bold text-zinc-900">
                    {qty}{" "}
                    <span className="text-sm font-medium text-zinc-500">
                      adet sipariş
                    </span>
                  </p>
                </div>
                <p className="shrink-0 text-base font-semibold">
                  {formatPrice(item.unit_earning * qty)}
                </p>
              </div>

              {showStockInfo ? (
                <div
                  className={`mt-3 rounded-xl px-3 py-2.5 ${
                    shortage
                      ? "bg-rose-50 text-rose-800"
                      : "bg-emerald-50 text-emerald-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">Güncel stok</span>
                    <span className="font-bold tabular-nums">
                      {currentStock} adet
                    </span>
                  </div>
                  {shortage ? (
                    <p className="mt-1.5 text-sm font-semibold">
                      {missing} adet eksik — stoğunuzu tamamlayın
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm font-medium">
                      Stok sipariş için yeterli
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Kargo Kodu</h2>
        {order.cargo_image_url ? (
          <button
            type="button"
            onClick={() => setCargoPreviewOpen(true)}
            className="mt-3 w-full rounded-xl bg-zinc-900 py-3 text-base font-medium text-white"
          >
            Kargo kodunu görüntüle
          </button>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Yönetici henüz kargo kodu (görsel/PDF) yüklemedi
          </p>
        )}
      </div>

      {message ? (
        <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {message}
        </p>
      ) : null}

      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4">
        <span className="text-base font-medium">Durum</span>
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium">
          {PRODUCER_ORDER_STATUS[order.status] || order.status}
        </span>
      </div>

      {nextStatus ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={updating}
            onClick={() => updateStatus(nextStatus)}
            className="w-full rounded-2xl bg-orange-600 py-4 text-lg font-semibold text-white disabled:opacity-60"
          >
            {updating ? "Güncelleniyor..." : NEXT_ACTION_LABEL[order.status]}
          </button>
          {order.status === "created" ? (
            <button
              type="button"
              disabled={updating}
              onClick={() => setRejectOpen(true)}
              className="w-full rounded-2xl border border-rose-200 bg-rose-50 py-4 text-lg font-semibold text-rose-700 disabled:opacity-60"
            >
              Siparişi Reddet
            </button>
          ) : null}
        </div>
      ) : order.status === "cancelled" ? (
        <p className="rounded-2xl bg-rose-50 py-3 text-center text-base font-medium text-rose-700">
          Bu sipariş iptal edildi
        </p>
      ) : order.status === "rejected" ? (
        <p className="rounded-2xl bg-rose-50 py-3 text-center text-base font-medium text-rose-700">
          Bu siparişi reddettiniz
        </p>
      ) : isFinished ? (
        <p className="rounded-2xl bg-emerald-50 py-3 text-center text-base font-medium text-emerald-700">
          Bu sipariş tamamlandı
        </p>
      ) : null}

      <ImageLightbox
        src={cargoPreviewOpen ? order.cargo_image_url : ""}
        alt="Kargo kodu"
        onClose={() => setCargoPreviewOpen(false)}
      />

      {rejectOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-order-title"
          >
            <h3
              id="reject-order-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Siparişi reddetmek istiyor musunuz?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Bu sipariş sizden alınır ve başka bir üreticiye yeniden
              dağıtılabilir.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={updating}
                onClick={() => setRejectOpen(false)}
                className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={rejectOrder}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {updating ? "Reddediliyor..." : "Evet, reddet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
