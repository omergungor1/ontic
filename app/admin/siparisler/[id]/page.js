"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImageLightbox from "@/components/ImageLightbox";
import BackButton from "@/components/BackButton";
import {
  formatDate,
  formatPrice,
  INTERNAL_ORDER_STATUS,
  PRODUCER_ORDER_STATUS,
} from "@/lib/format";

function producerStatusClass(status) {
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

const emptyDraftLine = () => ({
  producerId: "",
  quantity: 0,
  unitEarning: "",
  earningEditable: false,
});

function productUnitEarning(item) {
  const price = item?.products?.producer_price;
  if (price == null || price === "") return "";
  return String(price);
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [producerOrders, setProducerOrders] = useState([]);
  const [candidatesByProduct, setCandidatesByProduct] = useState({});
  const [allProducers, setAllProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cargoUploadingId, setCargoUploadingId] = useState(null);
  const [cargoPreviewUrl, setCargoPreviewUrl] = useState("");
  const [orderCancelOpen, setOrderCancelOpen] = useState(false);
  const [orderCancelSaving, setOrderCancelSaving] = useState(false);
  const cargoFileRefs = useRef({});

  // Dağıtım modalı — ürün bazlı: her kalemde ayrı üretici
  const [assignOpen, setAssignOpen] = useState(false);
  const [draftLines, setDraftLines] = useState({}); // itemId -> { producerId, quantity, unitEarning }
  const [pickerItemId, setPickerItemId] = useState(null); // üretici açılacak sipariş kalemi
  const [enablingProducer, setEnablingProducer] = useState(false);

  async function load({ silent = false } = {}) {
    if (!orderId) return;
    if (!silent) setLoading(true);
    const supabase = createClient();

    const { data: orderData } = await supabase
      .from("trendyol_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    const { data: itemsData } = await supabase
      .from("trendyol_order_items")
      .select("*, products!product_id(id, title, image_url, producer_price)")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    const { data: producerOrdersData } = await supabase
      .from("producer_orders")
      .select(
        "*, profiles!producer_id(full_name, username), producer_order_items(*, products!product_id(title))"
      )
      .eq("trendyol_order_id", orderId)
      .order("created_at", { ascending: false });

    const { data: producers } = await supabase
      .from("profiles")
      .select("id, full_name, username, is_active")
      .eq("role", "producer")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    const productIds = [
      ...new Set((itemsData || []).map((i) => i.product_id).filter(Boolean)),
    ];

    let candidateMap = {};
    if (productIds.length) {
      const { data: candidates } = await supabase
        .from("producer_products")
        .select(
          "*, profiles!producer_id(id, full_name, username, is_active)"
        )
        .in("product_id", productIds)
        .eq("is_active", true);

      for (const row of candidates || []) {
        if (!row.profiles?.is_active) continue;
        if (!candidateMap[row.product_id]) candidateMap[row.product_id] = [];
        candidateMap[row.product_id].push(row);
      }
      Object.keys(candidateMap).forEach((key) => {
        candidateMap[key].sort(
          (a, b) => (b.stock_quantity || 0) - (a.stock_quantity || 0)
        );
      });
    }

    setOrder(orderData || null);
    setItems(itemsData || []);
    setProducerOrders(producerOrdersData || []);
    setCandidatesByProduct(candidateMap);
    setAllProducers(producers || []);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Kalan adet = toplam - iptal edilmemiş atamalar
  const remainingByItem = useMemo(() => {
    const map = {};
    for (const item of items) {
      map[item.id] =
        Number(item.quantity) - Number(item.assigned_quantity || 0);
    }
    return map;
  }, [items]);

  const remainingItems = useMemo(
    () => items.filter((item) => remainingByItem[item.id] > 0),
    [items, remainingByItem]
  );

  const totalRemaining = useMemo(
    () => remainingItems.reduce((sum, item) => sum + remainingByItem[item.id], 0),
    [remainingItems, remainingByItem]
  );

  function producersForItem(item) {
    if (!item?.product_id) {
      return allProducers.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        username: p.username,
        stock_quantity: null,
      }));
    }
    return (candidatesByProduct[item.product_id] || [])
      .map((c) => ({
        id: c.profiles?.id || c.producer_id,
        full_name: c.profiles?.full_name,
        username: c.profiles?.username,
        stock_quantity: c.stock_quantity,
      }))
      .filter((p) => p.id)
      .sort((a, b) => (b.stock_quantity || 0) - (a.stock_quantity || 0));
  }

  function openAssignModal() {
    setError("");
    setMessage("");
    setDraftLines({});
    setPickerItemId(null);
    setAssignOpen(true);
  }

  function closeAssignModal() {
    if (saving || enablingProducer) return;
    setAssignOpen(false);
    setDraftLines({});
    setPickerItemId(null);
  }

  function setLine(itemId, patch) {
    setDraftLines((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || emptyDraftLine()), ...patch },
    }));
  }

  function changeQuantity(item, delta) {
    const remaining = remainingByItem[item.id];
    const current = Number(draftLines[item.id]?.quantity || 0);
    const next = Math.min(Math.max(0, current + delta), remaining);
    setLine(item.id, { quantity: next });
  }

  function setAllQuantity(item) {
    setLine(item.id, { quantity: remainingByItem[item.id] });
  }

  async function enableProducerForItem(producer) {
    const item = items.find((i) => i.id === pickerItemId);
    if (!producer?.id || !item) return;

    setEnablingProducer(true);
    setError("");
    try {
      if (item.product_id) {
        const supabase = createClient();
        const { error: upsertError } = await supabase
          .from("producer_products")
          .upsert(
            {
              producer_id: producer.id,
              product_id: item.product_id,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "producer_id,product_id" }
          );
        if (upsertError) throw upsertError;
        await load({ silent: true });
      }

      {
        const prev = draftLines[item.id] || emptyDraftLine();
        setLine(item.id, {
          producerId: producer.id,
          quantity:
            Number(prev.quantity || 0) || remainingByItem[item.id] || 1,
          unitEarning: prev.earningEditable
            ? prev.unitEarning
            : productUnitEarning(item),
        });
      }
      setPickerItemId(null);
      setMessage(
        `${producer.full_name}, "${item.product_name || "ürün"}" için üretiyor olarak açıldı`
      );
    } catch (err) {
      setError(err.message || "Üretici açılamadı");
    } finally {
      setEnablingProducer(false);
    }
  }

  const draftTotalQty = useMemo(
    () =>
      Object.values(draftLines).reduce(
        (sum, line) =>
          sum +
          (line.producerId && Number(line.quantity) > 0
            ? Number(line.quantity)
            : 0),
        0
      ),
    [draftLines]
  );

  async function submitAssignment() {
    const byProducer = {};

    for (const item of remainingItems) {
      const line = draftLines[item.id];
      const qty = Number(line?.quantity || 0);
      const producerId = line?.producerId;
      if (!producerId || qty <= 0) continue;

      const remaining = remainingByItem[item.id] || 0;
      if (qty > remaining) {
        setError(
          `"${item.product_name || "Ürün"}" için seçilen adet kalan miktardan fazla`
        );
        return;
      }

      const unitEarning = Number(
        line.unitEarning !== "" && line.unitEarning != null
          ? line.unitEarning
          : productUnitEarning(item) || 0
      );

      if (!byProducer[producerId]) byProducer[producerId] = [];
      byProducer[producerId].push({
        orderItemId: item.id,
        productId: item.product_id || null,
        quantity: qty,
        unitEarning,
      });
    }

    const assignments = Object.entries(byProducer).map(
      ([producerId, assignItems]) => ({
        producerId,
        items: assignItems,
      })
    );

    if (!assignments.length) {
      setError("En az bir ürün için üretici ve adet seçin");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/orders/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, assignments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dağıtım başarısız");

      setAssignOpen(false);
      setDraftLines({});
      setPickerItemId(null);
      setMessage("Sipariş üreticilere dağıtıldı");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelProducerOrder(producerOrderId) {
    if (!confirm("Bu üretici siparişini iptal etmek istiyor musunuz?")) return;
    const res = await fetch("/api/admin/orders/cancel-producer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ producerOrderId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "İptal başarısız");
      return;
    }
    setMessage("Üretici siparişi iptal edildi. Kalan ürünler tekrar dağıtılabilir.");
    await load();
  }

  async function uploadCargoForProducerOrder(producerOrderId, file) {
    if (!file || !producerOrderId) return;

    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    const isPdf = type === "application/pdf" || name.endsWith(".pdf");
    const isImage = type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("Kargo kodu için görsel veya PDF yükleyin");
      return;
    }

    setCargoUploadingId(producerOrderId);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "cargo-images");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Yükleme başarısız");

      const res = await fetch(`/api/producer-orders/${producerOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cargoImageUrl: uploadData.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kargo kodu kaydedilemedi");

      setMessage(isPdf ? "Kargo PDF yüklendi" : "Kargo kodu yüklendi");
      await load({ silent: true });
    } catch (err) {
      setError(err.message || "Kargo kodu yüklenemedi");
    } finally {
      setCargoUploadingId(null);
      const input = cargoFileRefs.current[producerOrderId];
      if (input) input.value = "";
    }
  }

  async function confirmOrderCancelToggle() {
    if (!order) return;
    const restoring = order.internal_status === "cancelled";
    setOrderCancelSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          action: restoring ? "restore" : "cancel",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      setOrderCancelOpen(false);
      setMessage(
        restoring
          ? "Sipariş iptali geri alındı"
          : "Sipariş ve bağlı üretici siparişleri iptal edildi"
      );
      await load();
    } catch (err) {
      setError(err.message);
      setOrderCancelOpen(false);
    } finally {
      setOrderCancelSaving(false);
    }
  }

  if (loading) return <p>Yükleniyor...</p>;
  if (!order)
    return (
      <div className="space-y-3">
        <BackButton href="/admin/siparisler" label="Siparişlere dön" />
        <p>Sipariş bulunamadı.</p>
      </div>
    );

  const orderCancelled = order.internal_status === "cancelled";
  const pickerItem = items.find((i) => i.id === pickerItemId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackButton
            onClick={() => router.push("/admin/siparisler")}
            label="Siparişlere dön"
            className="mb-3"
          />
          <h1 className="text-2xl font-semibold">
            Sipariş {order.order_number}
          </h1>
          <p className="text-zinc-500">
            {order.customer_first_name} {order.customer_last_name} ·{" "}
            {formatDate(order.order_date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium">
            {INTERNAL_ORDER_STATUS[order.internal_status] ||
              order.internal_status}
          </span>
          <button
            type="button"
            onClick={() => setOrderCancelOpen(true)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${orderCancelled
                ? "bg-emerald-600 text-white"
                : "bg-rose-600 text-white"
              }`}
          >
            {orderCancelled ? "İptali Geri Al" : "Siparişi İptal Et"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Brüt Tutar</p>
          <p className="mt-1 text-xl font-semibold">
            {formatPrice(order.gross_amount)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Komisyon</p>
          <p className="mt-1 text-xl font-semibold">
            {formatPrice(order.commission_amount)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Net Tutar</p>
          <p className="mt-1 text-xl font-semibold">
            {formatPrice(order.net_amount)}
          </p>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error && !assignOpen ? (
        <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {/* Sipariş ürün özeti */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Sipariş Ürünleri</h2>
        <div className="space-y-2">
          {items.map((item) => {
            const remaining = remainingByItem[item.id];
            const imageUrl = item.products?.image_url;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-3 sm:px-4"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={item.product_name || item.products?.title || "Ürün"}
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
                  <p className="truncate font-medium">
                    {item.product_name || item.products?.title || "Ürün"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {item.barcode ? `Barkod: ${item.barcode} · ` : ""}
                    Toplam {item.quantity} · Dağıtılan{" "}
                    {item.assigned_quantity || 0}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${remaining > 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                    }`}
                >
                  {remaining > 0 ? `Kalan ${remaining}` : "Tamamen dağıtıldı"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Üretici siparişleri + dağıtım */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Üretici Siparişleri</h2>
            <p className="text-sm text-zinc-500">
              {totalRemaining > 0
                ? `${totalRemaining} adet ürün dağıtılmayı bekliyor`
                : "Tüm ürünler dağıtıldı"}
            </p>
          </div>
          {!orderCancelled && totalRemaining > 0 ? (
            <button
              type="button"
              onClick={openAssignModal}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <span className="text-lg leading-none">+</span>
              Üreticiye Dağıt
            </button>
          ) : null}
        </div>

        {producerOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
            <p className="text-sm text-zinc-600">
              Henüz üreticiye dağıtım yapılmadı.
            </p>
            {!orderCancelled && totalRemaining > 0 ? (
              <button
                type="button"
                onClick={openAssignModal}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <span className="text-lg leading-none">+</span>
                İlk dağıtımı yap
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {producerOrders.map((po) => (
              <div
                key={po.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{po.profiles?.full_name}</p>
                    <p className="text-xs text-zinc-500">
                      @{po.profiles?.username} · {formatDate(po.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${producerStatusClass(
                        po.status
                      )}`}
                    >
                      {PRODUCER_ORDER_STATUS[po.status] || po.status}
                    </span>
                    {po.status !== "cancelled" && po.status !== "rejected" ? (
                      <button
                        type="button"
                        onClick={() => cancelProducerOrder(po.id)}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600"
                      >
                        İptal Et
                      </button>
                    ) : null}
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-zinc-600">
                  {(po.producer_order_items || []).map((line) => (
                    <li key={line.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {line.products?.title || "Ürün"} × {line.quantity}
                      </span>
                      <span className="shrink-0">
                        {formatPrice(line.unit_earning * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2 text-sm">
                  <span className="text-zinc-500">Üretici Kazancı</span>
                  <span className="font-semibold">
                    {formatPrice(po.producer_earning)}
                  </span>
                </div>

                <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                  <p className="text-xs font-medium text-zinc-500">
                    Kargo kodu (görsel veya PDF)
                  </p>
                  {po.cargo_image_url ? (
                    <button
                      type="button"
                      onClick={() => setCargoPreviewUrl(po.cargo_image_url)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left text-sm font-medium text-orange-700 hover:bg-zinc-100"
                    >
                      Kargo kodunu görüntüle
                    </button>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Bu üretici siparişi için henüz kargo kodu yok
                    </p>
                  )}
                  <input
                    ref={(el) => {
                      if (el) cargoFileRefs.current[po.id] = el;
                    }}
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) =>
                      uploadCargoForProducerOrder(po.id, e.target.files?.[0])
                    }
                  />
                  <button
                    type="button"
                    disabled={
                      cargoUploadingId === po.id ||
                      po.status === "cancelled" ||
                      po.status === "rejected"
                    }
                    onClick={() => cargoFileRefs.current[po.id]?.click()}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    {cargoUploadingId === po.id
                      ? "Yükleniyor..."
                      : po.cargo_image_url
                        ? "Kargo kodunu değiştir"
                        : "Kargo kodu yükle"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dağıtım modalı — ürün bazlı */}
      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-[85vh] sm:rounded-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">Üreticiye Dağıt</h3>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Her ürün için ayrı üretici ve adet seçin
                </p>
              </div>
              <button
                type="button"
                onClick={closeAssignModal}
                className="rounded-full px-2 py-1 text-xl leading-none text-zinc-400 hover:bg-zinc-100"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
              {remainingItems.length === 0 ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                  Dağıtılacak kalan ürün yok.
                </p>
              ) : (
                remainingItems.map((item) => {
                  const remaining = remainingByItem[item.id];
                  const line = draftLines[item.id] || emptyDraftLine();
                  const options = producersForItem(item);
                  const imageUrl = item.products?.image_url;
                  const selected = options.find((p) => p.id === line.producerId);

                  return (
                    <div
                      key={item.id}
                      className="min-w-0 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={item.product_name || "Ürün"}
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
                          <p className="text-sm font-medium leading-snug">
                            {item.product_name || item.products?.title || "Ürün"}
                          </p>
                          <div className="mt-2 inline-flex items-baseline gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-amber-900">
                            <span className="text-lg font-bold tabular-nums leading-none">
                              {remaining}
                            </span>
                            <span className="text-xs font-semibold">
                              adet kaldı
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Toplam sipariş: {item.quantity} · Atanan:{" "}
                            {Number(item.assigned_quantity || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block min-w-0">
                          <span className="mb-1 block text-xs text-zinc-500">
                            Üretici
                          </span>
                          <select
                            value={line.producerId}
                            onChange={(e) => {
                              const producerId = e.target.value;
                              setLine(item.id, {
                                producerId,
                                quantity:
                                  producerId && !Number(line.quantity)
                                    ? remaining
                                    : line.quantity,
                                unitEarning: line.earningEditable
                                  ? line.unitEarning
                                  : productUnitEarning(item),
                              });
                            }}
                            className="w-full min-w-0 max-w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
                          >
                            <option value="">Üretici seç</option>
                            {options.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.full_name}
                                {p.stock_quantity != null
                                  ? ` (stok: ${p.stock_quantity})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          onClick={() => setPickerItemId(item.id)}
                          className="w-full rounded-xl border border-dashed border-orange-300 bg-orange-50 px-3 py-2.5 text-sm font-medium text-orange-700"
                        >
                          {options.length
                            ? "+ Bu ürün için üretici aç"
                            : "Üretici Aç"}
                        </button>

                        {selected ? (
                          <p className="text-xs text-emerald-700">
                            Seçili: {selected.full_name}
                          </p>
                        ) : null}
                      </div>

                      {line.producerId ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => changeQuantity(item, -1)}
                              className="h-10 w-10 rounded-xl border border-zinc-300 bg-white text-lg font-semibold"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              inputMode="numeric"
                              value={line.quantity}
                              onChange={(e) =>
                                setLine(item.id, {
                                  quantity: Math.min(
                                    Math.max(0, Number(e.target.value || 0)),
                                    remaining
                                  ),
                                })
                              }
                              className="h-10 w-16 rounded-xl border border-zinc-300 bg-white text-center text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => changeQuantity(item, 1)}
                              disabled={Number(line.quantity) >= remaining}
                              className="h-10 w-10 rounded-xl border border-zinc-300 bg-white text-lg font-semibold disabled:opacity-40"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => setAllQuantity(item)}
                              className="h-10 rounded-xl bg-zinc-900 px-3 text-xs font-medium text-white"
                            >
                              Tümü ({remaining})
                            </button>
                          </div>

                          <div className="block">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs text-zinc-500">
                                Birim kazanç ₺
                              </span>
                              {line.earningEditable ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLine(item.id, {
                                      earningEditable: false,
                                      unitEarning: productUnitEarning(item),
                                    })
                                  }
                                  className="text-xs font-medium text-zinc-600 underline"
                                >
                                  Sabit fiyata dön
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLine(item.id, {
                                      earningEditable: true,
                                      unitEarning:
                                        line.unitEarning ||
                                        productUnitEarning(item),
                                    })
                                  }
                                  className="text-xs font-medium text-orange-700 underline"
                                >
                                  Düzenle
                                </button>
                              )}
                            </div>
                            {line.earningEditable ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                placeholder="0"
                                value={line.unitEarning}
                                onChange={(e) =>
                                  setLine(item.id, {
                                    unitEarning: e.target.value,
                                  })
                                }
                                className="w-full rounded-xl border border-orange-300 bg-white px-3 py-2.5 text-sm"
                              />
                            ) : (
                              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium">
                                {formatPrice(
                                  Number(
                                    line.unitEarning ||
                                    productUnitEarning(item) ||
                                    0
                                  )
                                )}
                                <span className="ml-2 text-xs font-normal text-zinc-500">
                                  (ürün sabit fiyatı)
                                </span>
                              </div>
                            )}
                            {!Number(
                              line.unitEarning || productUnitEarning(item) || 0
                            ) ? (
                              <p className="mt-1 text-[11px] text-amber-700">
                                Ürünler sayfasında üretici fiyatı tanımlı değil.
                              </p>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })
              )}

              {error && assignOpen ? (
                <p className="text-sm text-rose-600">{error}</p>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-zinc-100 px-4 py-4 sm:px-5">
              <div className="mb-3 flex items-center justify-between rounded-xl bg-zinc-100 px-3.5 py-3">
                <span className="text-sm font-medium text-zinc-600">
                  Bu dağıtıma seçilen
                </span>
                <span className="text-xl font-bold tabular-nums text-zinc-900">
                  {draftTotalQty}{" "}
                  <span className="text-sm font-semibold text-zinc-500">
                    adet
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  disabled={saving}
                  className="rounded-xl border border-zinc-200 py-3 text-sm font-medium"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={submitAssignment}
                  disabled={saving || draftTotalQty <= 0}
                  className="rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Kaydediliyor..." : "Dağıtımı Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Ürün bazlı üretici aç */}
      {pickerItemId ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">Üretici Aç</h3>
                <p className="mt-0.5 truncate text-sm text-zinc-500">
                  {pickerItem?.product_name || "Ürün"} için üretiyor aç
                </p>
              </div>
              <button
                type="button"
                disabled={enablingProducer}
                onClick={() => setPickerItemId(null)}
                className="rounded-full px-2 py-1 text-xl leading-none text-zinc-400 hover:bg-zinc-100"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {allProducers.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                  Aktif üretici yok. Önce Üreticiler sayfasından üretici ekleyin.
                </p>
              ) : (
                allProducers.map((p) => {
                  const already =
                    pickerItem &&
                    producersForItem(pickerItem).some((o) => o.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={enablingProducer}
                      onClick={() => enableProducerForItem(p)}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-3 text-left hover:border-orange-400 hover:bg-orange-50 disabled:opacity-60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {p.full_name}
                        </p>
                        <p className="text-xs text-zinc-500">@{p.username}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-orange-700">
                        {enablingProducer
                          ? "Açılıyor..."
                          : already
                            ? "Seç"
                            : "Aç"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        src={cargoPreviewUrl}
        alt="Kargo kodu"
        onClose={() => setCargoPreviewUrl("")}
      />

      {orderCancelOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-cancel-title"
          >
            <h3
              id="order-cancel-title"
              className="text-lg font-semibold text-zinc-900"
            >
              {orderCancelled
                ? "İptali geri almak istiyor musunuz?"
                : "Siparişi iptal etmek istiyor musunuz?"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {orderCancelled
                ? "Sipariş yeniden dağıtım durumuna alınır. Daha önce iptal edilen üretici siparişleri otomatik geri gelmez."
                : "Sipariş iptal edilecek ve bu siparişe bağlı tüm üretici siparişleri de iptal edilecek."}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={orderCancelSaving}
                onClick={() => setOrderCancelOpen(false)}
                className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={orderCancelSaving}
                onClick={confirmOrderCancelToggle}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60 ${
                  orderCancelled ? "bg-emerald-600" : "bg-rose-600"
                }`}
              >
                {orderCancelSaving
                  ? "İşleniyor..."
                  : orderCancelled
                    ? "Evet, geri al"
                    : "Evet, iptal et"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
