"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StorageImage from "@/components/StorageImage";
import { formatDate, formatPrice, INTERNAL_ORDER_STATUS } from "@/lib/format";
import { deriveInternalStatus } from "@/lib/assigned-quantity";

const FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "pending_assignment", label: "Dağıtım bekliyor" },
  { key: "partially_assigned", label: "Kısmen dağıtıldı" },
  { key: "assigned", label: "Dağıtıldı" },
  { key: "completed", label: "Tamamlandı" },
  { key: "cancelled", label: "İptal" },
];

function statusBadgeClass(status) {
  switch (status) {
    case "pending_assignment":
      return "bg-amber-100 text-amber-700";
    case "partially_assigned":
      return "bg-sky-100 text-sky-700";
    case "assigned":
      return "bg-emerald-100 text-emerald-700";
    case "completed":
      return "bg-zinc-200 text-zinc-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

const emptyLine = () => ({
  entryMode: "select",
  productId: "",
  productName: "",
  barcode: "",
  quantity: 1,
  unitPrice: "",
  imageUrl: "",
});

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  const [uploadingLine, setUploadingLine] = useState(null);
  const [products, setProducts] = useState([]);
  const [manual, setManual] = useState({
    customerFirstName: "",
    customerLastName: "",
    lines: [emptyLine()],
  });

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("trendyol_orders")
      .select(
        "*, producer_orders(id, status, producer_order_items(order_item_id, product_id, quantity)), trendyol_order_items(id, quantity, product_id, assigned_quantity)"
      )
      .order("order_date", { ascending: false })
      .limit(200);
    setOrders(data || []);
    setLoading(false);
  }

  function orderStatus(order) {
    return deriveInternalStatus(
      order,
      order.trendyol_order_items,
      order.producer_orders
    );
  }

  function needsRejectionWarning(order) {
    const status = orderStatus(order);
    const awaiting =
      status === "pending_assignment" || status === "partially_assigned";
    if (!awaiting) return false;
    return (order.producer_orders || []).some((po) => po.status === "rejected");
  }

  async function loadProducts() {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("id, title, is_active, image_url, product_variants(barcode, sale_price)")
      .eq("is_active", true)
      .order("title", { ascending: true });
    setProducts(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (filter !== "all") {
      list = list.filter((order) => orderStatus(order) === filter);
    }
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((order) => {
        const name = `${order.customer_first_name || ""} ${order.customer_last_name || ""
          }`.toLowerCase();
        return (
          order.order_number?.toLowerCase().includes(term) ||
          name.includes(term)
        );
      });
    }
    return list;
  }, [orders, filter, search]);

  async function sync() {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "orders", days: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync başarısız");
      setMessage(`${data.synced} sipariş senkronlandı`);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSyncing(false);
    }
  }

  function openManual() {
    setManualError("");
    setManual({
      customerFirstName: "",
      customerLastName: "",
      lines: [emptyLine()],
    });
    if (!products.length) loadProducts();
    setManualOpen(true);
  }

  function updateLine(index, patch) {
    setManual((prev) => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], ...patch };
      return { ...prev, lines };
    });
  }

  function pickProduct(index, productId) {
    if (!productId) {
      updateLine(index, {
        entryMode: "select",
        productId: "",
        productName: "",
        barcode: "",
        unitPrice: "",
        imageUrl: "",
      });
      return;
    }
    const product = products.find((p) => p.id === productId);
    const variant = product?.product_variants?.[0];
    updateLine(index, {
      entryMode: "select",
      productId,
      productName: product?.title || "",
      barcode: variant?.barcode || "",
      unitPrice: variant?.sale_price ?? "",
      imageUrl: product?.image_url || "",
    });
  }

  function addLine() {
    setManual((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  }

  function removeLine(index) {
    setManual((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  }

  function setEntryMode(index, entryMode) {
    if (entryMode === "manual") {
      updateLine(index, {
        entryMode: "manual",
        productId: "",
        barcode: "",
        imageUrl: "",
        productName: "",
      });
      return;
    }
    updateLine(index, {
      entryMode: "select",
      productId: "",
      productName: "",
      barcode: "",
      imageUrl: "",
    });
  }

  async function uploadLineImage(index, file) {
    if (!file) return;
    const name = String(manual.lines[index]?.productName || "").trim();
    if (!name) {
      setManualError("Önce ürün adını girin");
      return;
    }
    setUploadingLine(index);
    setManualError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "product-request-images");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Görsel yüklenemedi");
      updateLine(index, { imageUrl: data.url });
    } catch (err) {
      setManualError(err.message);
    } finally {
      setUploadingLine(null);
    }
  }

  async function submitManual(e) {
    e.preventDefault();
    setManualSaving(true);
    setManualError("");
    try {
      const lines = [];
      for (const line of manual.lines) {
        const productName = String(line.productName || "").trim();
        const qty = Number(line.quantity);
        if (!productName || !(qty > 0)) continue;
        const isManual = line.entryMode === "manual";
        if (!isManual && !line.productId) {
          throw new Error(`"${productName}" için listeden ürün seçin`);
        }
        lines.push({
          productId: isManual ? null : line.productId || null,
          productName,
          barcode: isManual ? null : line.barcode || null,
          quantity: qty,
          unitPrice: Number(line.unitPrice || 0),
          imageUrl: isManual ? line.imageUrl || null : null,
        });
      }

      if (!lines.length) {
        throw new Error("En az bir ürün satırı ekleyin");
      }

      const res = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerFirstName: manual.customerFirstName,
          customerLastName: manual.customerLastName,
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sipariş oluşturulamadı");
      setManualOpen(false);
      await load();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualSaving(false);
    }
  }

  const lineTotal = (line) =>
    Number(line.quantity || 0) * Number(line.unitPrice || 0);
  const manualTotal = manual.lines.reduce((sum, l) => sum + lineTotal(l), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Siparişler</h1>
          <p className="text-zinc-500">Trendyol siparişleri ve manuel ekleme</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={openManual}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium"
          >
            Manuel sipariş ekle
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={sync}
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {syncing ? "Sync..." : "Trendyol Sync (30 gün)"}
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}

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
          placeholder="Sipariş no veya müşteri ara"
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : filteredOrders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Sipariş bulunamadı
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Sipariş No</th>
                  <th className="whitespace-nowrap px-4 py-3">Müşteri</th>
                  <th className="whitespace-nowrap px-4 py-3">Tarih</th>
                  <th className="whitespace-nowrap px-4 py-3">Tutar</th>
                  <th className="whitespace-nowrap px-4 py-3">
                    Trendyol Durumu
                  </th>
                  <th className="whitespace-nowrap px-4 py-3">
                    Dağıtım Durumu
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() =>
                      router.push(`/admin/siparisler/${order.id}`)
                    }
                    className="cursor-pointer border-t border-zinc-100 hover:bg-orange-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {order.order_number}
                      {order.is_manual ? (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                          Manuel
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {order.customer_first_name} {order.customer_last_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatPrice(order.net_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {order.status || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                            orderStatus(order)
                          )}`}
                        >
                          {INTERNAL_ORDER_STATUS[orderStatus(order)] ||
                            orderStatus(order)}
                        </span>
                        {needsRejectionWarning(order) ? (
                          <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">
                            RET
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {manualOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <form
            onSubmit={submitManual}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-[85vh] sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">Manuel Sipariş</h3>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Ürün ve adet seçerek sipariş oluşturun
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="rounded-full px-2 py-1 text-xl leading-none text-zinc-400 hover:bg-zinc-100"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-zinc-500">
                    Müşteri adı
                  </span>
                  <input
                    required
                    placeholder="Ad"
                    value={manual.customerFirstName}
                    onChange={(e) =>
                      setManual((prev) => ({
                        ...prev,
                        customerFirstName: e.target.value,
                      }))
                    }
                    className="w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-zinc-500">
                    Müşteri soyadı
                  </span>
                  <input
                    required
                    placeholder="Soyad"
                    value={manual.customerLastName}
                    onChange={(e) =>
                      setManual((prev) => ({
                        ...prev,
                        customerLastName: e.target.value,
                      }))
                    }
                    className="w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Ürünler
                </p>
                {manual.lines.map((line, index) => (
                  <div
                    key={index}
                    className="min-w-0 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-700">
                        Satır {index + 1}
                      </span>
                      {manual.lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Sil
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                          line.entryMode !== "manual"
                            ? "border-orange-500 bg-orange-50 text-orange-800"
                            : "border-zinc-200 bg-white text-zinc-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`entry-mode-${index}`}
                          checked={line.entryMode !== "manual"}
                          onChange={() => setEntryMode(index, "select")}
                          className="accent-orange-600"
                        />
                        Ürün seç
                      </label>
                      <label
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                          line.entryMode === "manual"
                            ? "border-orange-500 bg-orange-50 text-orange-800"
                            : "border-zinc-200 bg-white text-zinc-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`entry-mode-${index}`}
                          checked={line.entryMode === "manual"}
                          onChange={() => setEntryMode(index, "manual")}
                          className="accent-orange-600"
                        />
                        Manuel giriş
                      </label>
                    </div>

                    {line.entryMode === "manual" ? (
                      <>
                        <label className="block min-w-0">
                          <span className="mb-1 block text-xs text-zinc-500">
                            Ürün adı
                          </span>
                          <input
                            placeholder="Ürün adı"
                            value={line.productName}
                            onChange={(e) =>
                              updateLine(index, { productName: e.target.value })
                            }
                            className="w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </label>
                        <div className="space-y-2">
                          <span className="block text-xs text-zinc-500">
                            Ürün resmi (opsiyonel)
                          </span>
                          {line.imageUrl ? (
                            <div className="flex items-center gap-3">
                              <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-zinc-100">
                                <StorageImage
                                  src={line.imageUrl}
                                  alt={line.productName || "Ürün"}
                                  fill
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => updateLine(index, { imageUrl: "" })}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                              >
                                Kaldır
                              </button>
                            </div>
                          ) : null}
                          <label
                            className={`inline-flex rounded-xl border px-4 py-2.5 text-sm font-medium ${
                              !String(line.productName || "").trim() ||
                              uploadingLine === index
                                ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                                : "cursor-pointer border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={
                                !String(line.productName || "").trim() ||
                                uploadingLine === index
                              }
                              onChange={(e) => {
                                uploadLineImage(index, e.target.files?.[0]);
                                e.target.value = "";
                              }}
                            />
                            {uploadingLine === index
                              ? "Yükleniyor..."
                              : line.imageUrl
                                ? "Görseli değiştir"
                                : "Görsel yükle"}
                          </label>
                          {!String(line.productName || "").trim() ? (
                            <p className="text-[11px] text-zinc-500">
                              Görsel yüklemek için önce ürün adını girin
                            </p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <label className="block min-w-0">
                        <span className="mb-1 block text-xs text-zinc-500">
                          Listeden seç
                        </span>
                        <select
                          value={line.productId}
                          onChange={(e) => pickProduct(index, e.target.value)}
                          className="w-full min-w-0 max-w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Ürün seç</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                        {products.find((p) => p.id === line.productId)
                          ?.image_url ? (
                          <div className="relative mt-2 h-14 w-14 overflow-hidden rounded-xl bg-zinc-100">
                            <StorageImage
                              src={
                                products.find((p) => p.id === line.productId)
                                  .image_url
                              }
                              alt={line.productName || "Ürün"}
                              fill
                            />
                          </div>
                        ) : null}
                      </label>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block min-w-0">
                        <span className="mb-1 block text-xs text-zinc-500">
                          Adet
                        </span>
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(index, { quantity: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="mb-1 block text-xs text-zinc-500">
                          Birim fiyat ₺
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(index, { unitPrice: e.target.value })
                          }
                          className="w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </label>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addLine}
                  className="w-full rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-600"
                >
                  + Satır ekle
                </button>
              </div>

              {manualError ? (
                <p className="text-sm text-rose-600">{manualError}</p>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-zinc-100 bg-white px-4 py-4 sm:px-5">
              <p className="mb-3 text-sm text-zinc-600">
                Toplam:{" "}
                <span className="text-base font-semibold text-zinc-900">
                  {formatPrice(manualTotal)}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="rounded-xl border border-zinc-200 py-3 text-sm font-medium"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={manualSaving}
                  className="rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {manualSaving ? "Kaydediliyor..." : "Oluştur"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
