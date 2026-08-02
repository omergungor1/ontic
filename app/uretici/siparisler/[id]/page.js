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
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [cargoPreviewOpen, setCargoPreviewOpen] = useState(false);

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
    setItems(data?.producer_order_items || []);
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

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push("/uretici/siparisler")}
        className="text-sm text-zinc-500"
      >
        ← Siparişlerime dön
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

      <div className="rounded-2xl bg-emerald-600 px-5 py-4 text-white">
        <p className="text-sm opacity-90">Bu siparişten kazancınız</p>
        <p className="text-3xl font-bold">{formatPrice(order.producer_earning)}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Ürünler</h2>
        {items.map((item) => {
          const shortage =
            Number(item.stock_at_assignment) < Number(item.quantity);
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4"
            >
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
                <p className="text-base font-medium">
                  {item.products?.title || "Ürün"}
                </p>
                <p className="text-sm text-zinc-500">{item.quantity} adet</p>
                {shortage ? (
                  <p className="text-sm font-medium text-rose-600">
                    ⚠ {Number(item.quantity) - Number(item.stock_at_assignment)}{" "}
                    adet stok eksik
                  </p>
                ) : null}
              </div>
              <p className="font-semibold">
                {formatPrice(item.unit_earning * item.quantity)}
              </p>
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
            Yönetici henüz kargo kodu yüklemedi
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
        <button
          type="button"
          disabled={updating}
          onClick={() => updateStatus(nextStatus)}
          className="w-full rounded-2xl bg-orange-600 py-4 text-lg font-semibold text-white disabled:opacity-60"
        >
          {updating ? "Güncelleniyor..." : NEXT_ACTION_LABEL[order.status]}
        </button>
      ) : order.status === "cancelled" ? (
        <p className="rounded-2xl bg-rose-50 py-3 text-center text-base font-medium text-rose-700">
          Bu sipariş iptal edildi
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
    </div>
  );
}
