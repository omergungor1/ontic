"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import StorageImage from "@/components/StorageImage";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, truncate } from "@/lib/format";

const REQUEST_STATUS = {
  pending: "Beklemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  archived: "Arşiv",
};

function requestStatusClass(status) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-rose-100 text-rose-700";
    case "archived":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export default function ProducerProductsPage() {
  const [rows, setRows] = useState([]);
  const [savedMap, setSavedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const requestFileRef = useRef(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestImageUrl, setRequestImageUrl] = useState("");
  const [requestUploading, setRequestUploading] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState("");

  function showToast(text, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3000);
  }

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("producer_products")
      .select(
        "*, products!product_id(id, title, description, image_url, brand_name, producer_price)"
      )
      .eq("producer_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    const list = data || [];
    setRows(list);
    setSavedMap(
      Object.fromEntries(
        list.map((r) => [r.id, Number(r.stock_quantity || 0)])
      )
    );
    setLoading(false);
  }

  async function loadRequests() {
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/product-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Talepler yüklenemedi");
      setRequests(data.rows || []);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setRequestsLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function openRequestPanel() {
    setRequestOpen(true);
    setRequestError("");
    loadRequests();
  }

  function closeRequestPanel() {
    if (requestSaving || requestUploading) return;
    setRequestOpen(false);
    setRequestError("");
  }

  function isDirty(row) {
    const current = Number(row.stock_quantity || 0);
    const saved = Number(savedMap[row.id] ?? 0);
    return current !== saved;
  }

  function updateStock(id, value) {
    const next = Math.max(0, Number(value || 0));
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, stock_quantity: next } : r))
    );
  }

  function onStockInput(id, raw) {
    if (raw === "") {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, stock_quantity: "" } : r))
      );
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    updateStock(id, Math.max(0, parsed));
  }

  async function saveStock(row) {
    const quantity = Math.max(0, Number(row.stock_quantity || 0));
    setSavingId(row.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("producer_products")
      .update({
        stock_quantity: quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setSavingId("");
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, stock_quantity: quantity } : r
      )
    );
    setSavedMap((prev) => ({ ...prev, [row.id]: quantity }));
    showToast("Stok güncellendi");
  }

  async function uploadRequestImage(file) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setRequestError("Yalnızca görsel yükleyebilirsiniz");
      return;
    }
    setRequestUploading(true);
    setRequestError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "product-request-images");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız");
      setRequestImageUrl(data.url);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setRequestUploading(false);
      if (requestFileRef.current) requestFileRef.current.value = "";
    }
  }

  async function submitRequest(e) {
    e.preventDefault();
    setRequestSaving(true);
    setRequestError("");
    try {
      const res = await fetch("/api/product-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: requestTitle,
          description: requestDescription,
          imageUrl: requestImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Talep gönderilemedi");
      setRequestTitle("");
      setRequestDescription("");
      setRequestImageUrl("");
      setRequests((prev) => [data.row, ...prev]);
      showToast("Ürün talebi gönderildi");
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setRequestSaving(false);
    }
  }

  const totalStock = rows.reduce(
    (sum, r) => sum + Number(r.stock_quantity || 0),
    0
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ürünlerim</h1>
          <p className="text-zinc-500">Ürettiğiniz ürünler ve stok adediniz</p>
        </div>
        <button
          type="button"
          onClick={openRequestPanel}
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Ürün talep et
        </button>
      </div>

      <div className="rounded-2xl bg-orange-600 px-5 py-4 text-white">
        <p className="text-sm opacity-90">Toplam Stoğunuz</p>
        <p className="text-3xl font-bold">{totalStock} adet</p>
      </div>

      {loading ? (
        <p className="text-lg text-zinc-500">Yükleniyor...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-base text-zinc-500">
          Admin henüz size ürün ataması yapmadı
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const dirty = isDirty(row);
            return (
              <div
                key={row.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (row.products?.image_url) {
                        setPreviewUrl(row.products.image_url);
                      }
                    }}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100"
                    aria-label="Ürün görselini büyüt"
                  >
                    {row.products?.image_url ? (
                      <Image
                        src={row.products.image_url}
                        alt={row.products.title || "Ürün"}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                        Yok
                      </div>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug text-zinc-900">
                      {row.products?.title || "Ürün"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {row.products?.brand_name || "Ontic"}
                    </p>
                    {row.products?.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                        {truncate(row.products.description, 140)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-500">
                      Stok
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateStock(
                          row.id,
                          Math.max(0, Number(row.stock_quantity || 0) - 1)
                        )
                      }
                      className="h-11 w-11 rounded-xl border border-zinc-300 text-lg font-semibold"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={row.stock_quantity}
                      onChange={(e) => onStockInput(row.id, e.target.value)}
                      className="h-11 w-20 rounded-xl border border-zinc-300 text-center text-base font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateStock(row.id, Number(row.stock_quantity || 0) + 1)
                      }
                      className="h-11 w-11 rounded-xl border border-zinc-300 text-lg font-semibold"
                    >
                      +
                    </button>
                    {dirty ? (
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => saveStock(row)}
                        className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {savingId === row.id ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    ) : null}
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs font-medium text-zinc-500">
                      Üretici fiyatı
                    </p>
                    <p className="text-base font-bold text-emerald-700">
                      {formatPrice(row.products?.producer_price)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {requestOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-[85vh] sm:rounded-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">Ürün Taleplerim</h3>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Elinizdeki ürünü yöneticiye bildirin
                </p>
              </div>
              <button
                type="button"
                onClick={closeRequestPanel}
                className="rounded-lg px-2 py-1 text-xl text-zinc-500"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
              <form onSubmit={submitRequest} className="space-y-3">
                <p className="text-sm font-semibold text-zinc-800">
                  Yeni ürün talebi
                </p>
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">
                    Ürün adı
                  </span>
                  <input
                    type="text"
                    required
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                    placeholder="Örn. Pamuklu tişört"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">
                    Açıklama
                  </span>
                  <textarea
                    required
                    rows={4}
                    value={requestDescription}
                    onChange={(e) => setRequestDescription(e.target.value)}
                    placeholder="Ürün hakkında bilgi, renk, beden, stok vb."
                    className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
                  />
                </label>
                <div>
                  <span className="mb-1 block text-xs text-zinc-500">
                    Ürün görseli
                  </span>
                  <input
                    ref={requestFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadRequestImage(e.target.files?.[0])}
                  />
                  {requestImageUrl ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(requestImageUrl)}
                        className="relative h-36 w-full overflow-hidden rounded-xl bg-zinc-100"
                      >
                        <StorageImage
                          src={requestImageUrl}
                          alt="Talep görseli"
                          fill
                        />
                      </button>
                      <button
                        type="button"
                        disabled={requestUploading}
                        onClick={() => requestFileRef.current?.click()}
                        className="w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-medium disabled:opacity-60"
                      >
                        {requestUploading
                          ? "Yükleniyor..."
                          : "Görseli değiştir"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={requestUploading}
                      onClick={() => requestFileRef.current?.click()}
                      className="w-full rounded-xl border border-dashed border-orange-300 bg-orange-50 py-8 text-sm font-medium text-orange-700 disabled:opacity-60"
                    >
                      {requestUploading ? "Yükleniyor..." : "Görsel yükle"}
                    </button>
                  )}
                </div>
                {requestError ? (
                  <p className="text-sm text-rose-600">{requestError}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={
                    requestSaving ||
                    requestUploading ||
                    !requestTitle.trim() ||
                    !requestDescription.trim() ||
                    !requestImageUrl
                  }
                  className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {requestSaving ? "Gönderiliyor..." : "Talebi gönder"}
                </button>
              </form>

              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <p className="text-sm font-semibold text-zinc-800">
                  Önceki taleplerim
                </p>
                {requestsLoading ? (
                  <p className="text-sm text-zinc-500">Yükleniyor...</p>
                ) : requests.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500">
                    Henüz ürün talebiniz yok
                  </p>
                ) : (
                  requests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold">
                          {req.title}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${requestStatusClass(
                            req.status
                          )}`}
                        >
                          {REQUEST_STATUS[req.status] || req.status}
                        </span>
                      </div>
                      {req.image_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(req.image_url)}
                          className="relative mt-2 h-24 w-full overflow-hidden rounded-lg bg-white"
                        >
                          <StorageImage
                            src={req.image_url}
                            alt={req.title}
                            fill
                          />
                        </button>
                      ) : null}
                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">
                        {req.description}
                      </p>
                      <p className="mt-2 text-xs text-zinc-400">
                        {formatDate(req.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox src={previewUrl} onClose={() => setPreviewUrl("")} />

      {toast ? (
        <div
          className={`fixed bottom-24 left-1/2 z-[70] w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm font-medium shadow-lg sm:bottom-6 ${
            toast.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-zinc-900 text-white"
          }`}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
