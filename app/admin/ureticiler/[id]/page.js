"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PhoneInput from "@/components/PhoneInput";
import BackButton from "@/components/BackButton";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, PRODUCER_ORDER_STATUS } from "@/lib/format";
import { formatPhoneInput, isValidTrMobile } from "@/lib/phone";

const TABS = [
  { key: "siparisler", label: "Siparişler" },
  { key: "urunler", label: "Ürettiği Ürünler" },
  { key: "ayarlar", label: "Ayarlar" },
];

const ORDERS_PAGE_SIZE = 10;

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

export default function AdminProducerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const producerId = params?.id;

  const [tab, setTab] = useState("siparisler");
  const [producer, setProducer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [modalPassword, setModalPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    city: "",
    district: "",
    iban: "",
    adminNote: "",
    isActive: true,
  });

  const [products, setProducts] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [productSearch, setProductSearch] = useState("");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersBootstrapping, setOrdersBootstrapping] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const ordersOffset = useRef(0);
  const ordersLoadingRef = useRef(false);
  const sentinelRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/producers/${producerId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Üretici bulunamadı");
      setProducer(data.producer);
      setForm({
        fullName: data.producer.full_name || "",
        phone: data.producer.phone
          ? formatPhoneInput(data.producer.phone)
          : "",
        city: data.producer.city || "",
        district: data.producer.district || "",
        iban: data.producer.iban || "",
        adminNote: data.producer.admin_note || "",
        isActive: data.producer.is_active,
      });

      const supabase = createClient();
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, title, image_url, brand_name, is_active")
        .order("title", { ascending: true });

      const assignMap = {};
      for (const pp of data.products || []) {
        assignMap[pp.product_id] = {
          isActive: pp.is_active,
          stockQuantity: pp.stock_quantity,
        };
      }

      setProducts(allProducts || []);
      setAssignments(assignMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders({ reset = false } = {}) {
    if (!producerId || ordersLoadingRef.current) return;
    if (!reset && !hasMoreOrders) return;

    ordersLoadingRef.current = true;
    if (reset) {
      setOrdersBootstrapping(true);
      setHasMoreOrders(true);
      ordersOffset.current = 0;
    } else {
      setOrdersLoading(true);
    }

    const from = reset ? 0 : ordersOffset.current;
    const supabase = createClient();
    const { data, error: ordersError } = await supabase
      .from("producer_orders")
      .select(
        "id, status, producer_earning, created_at, cargo_image_url, trendyol_order_id, trendyol_orders!trendyol_order_id(id, order_number, customer_first_name, customer_last_name), producer_order_items(id, quantity, unit_earning, products!product_id(title, image_url))"
      )
      .eq("producer_id", producerId)
      .order("created_at", { ascending: false })
      .range(from, from + ORDERS_PAGE_SIZE - 1);

    const batch = data || [];
    if (ordersError) {
      setError(ordersError.message);
    } else if (reset) {
      setOrders(batch);
      ordersOffset.current = batch.length;
    } else {
      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o.id));
        const next = [...prev];
        for (const order of batch) {
          if (!seen.has(order.id)) next.push(order);
        }
        return next;
      });
      ordersOffset.current = from + batch.length;
    }
    setHasMoreOrders(batch.length === ORDERS_PAGE_SIZE);
    ordersLoadingRef.current = false;
    setOrdersLoading(false);
    setOrdersBootstrapping(false);
  }

  useEffect(() => {
    if (producerId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producerId]);

  useEffect(() => {
    if (tab !== "siparisler" || !producerId) return;
    loadOrders({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, producerId]);

  useEffect(() => {
    if (tab !== "siparisler") return undefined;
    const el = sentinelRef.current;
    if (!el || !hasMoreOrders) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadOrders();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasMoreOrders, orders.length, ordersLoading]);

  function updateAssignment(productId, patch) {
    setAssignments((prev) => ({
      ...prev,
      [productId]: {
        isActive: prev[productId]?.isActive || false,
        stockQuantity: prev[productId]?.stockQuantity || 0,
        ...patch,
      },
    }));
  }

  const sortedProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    let list = products;
    if (term) {
      list = list.filter((p) => p.title?.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      const aActive = assignments[a.id]?.isActive ? 1 : 0;
      const bActive = assignments[b.id]?.isActive ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (a.title || "").localeCompare(b.title || "", "tr");
    });
  }, [products, assignments, productSearch]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (!isValidTrMobile(form.phone)) {
        throw new Error("Telefon 05XX XXX XX XX formatında olmalıdır");
      }

      const res = await fetch(`/api/admin/producers/${producerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");
      setMessage("Ayarlar kaydedildi");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveProducts(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const productAssignments = Object.entries(assignments).map(
        ([productId, val]) => ({
          productId,
          isActive: Boolean(val.isActive),
          stockQuantity: Number(val.stockQuantity || 0),
        })
      );

      const res = await fetch(`/api/admin/producers/${producerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productAssignments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");
      setMessage("Ürün atamaları kaydedildi");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openPasswordModal() {
    setModalPassword("");
    setError("");
    setPasswordModalOpen(true);
  }

  function closePasswordModal() {
    if (passwordSaving) return;
    setPasswordModalOpen(false);
    setModalPassword("");
  }

  async function updatePassword() {
    const password = modalPassword.trim();
    if (!password) {
      setError("Yeni şifre boş olamaz");
      return;
    }
    if (!confirm("Emin misiniz? Üreticinin şifresi değişecektir.")) {
      return;
    }

    setPasswordSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/producers/${producerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Şifre güncellenemedi");
      setPasswordModalOpen(false);
      setModalPassword("");
      setMessage("Şifre güncellendi");
      setShowPassword(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function deleteProducer() {
    if (!confirm("Bu üreticiyi tamamen silmek istiyor musunuz?")) return;
    const res = await fetch(`/api/admin/producers/${producerId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Silinemedi");
      return;
    }
    router.push("/admin/ureticiler");
  }

  if (loading) return <p>Yükleniyor...</p>;
  if (!producer)
    return (
      <div className="space-y-3">
        <BackButton href="/admin/ureticiler" label="Üreticilere dön" />
        <p>{error || "Üretici bulunamadı"}</p>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackButton
            onClick={() => router.push("/admin/ureticiler")}
            label="Üreticilere dön"
            className="mb-3"
          />
          <h1 className="text-2xl font-semibold">{producer.full_name}</h1>
          <p className="text-zinc-500">@{producer.username}</p>
        </div>
        {tab === "ayarlar" ? (
          <button
            type="button"
            onClick={deleteProducer}
            className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600"
          >
            Üreticiyi Sil
          </button>
        ) : null}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              setMessage("");
              setError("");
            }}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              tab === item.key
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 bg-white text-zinc-600"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {tab === "siparisler" ? (
        <div className="space-y-3">
          {ordersBootstrapping ? (
            <p className="text-sm text-zinc-500">Siparişler yükleniyor...</p>
          ) : orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
              Bu üreticiye ait sipariş yok
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const items = order.producer_order_items || [];
                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {order.trendyol_orders?.id ? (
                          <Link
                            href={`/admin/siparisler/${order.trendyol_orders.id}`}
                            className="font-semibold text-orange-600 hover:underline"
                          >
                            {order.trendyol_orders.order_number || "Sipariş"}
                          </Link>
                        ) : (
                          <p className="font-semibold">Sipariş</p>
                        )}
                        <p className="mt-0.5 text-sm text-zinc-500">
                          {order.trendyol_orders?.customer_first_name}{" "}
                          {order.trendyol_orders?.customer_last_name}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                          order.status
                        )}`}
                      >
                        {PRODUCER_ORDER_STATUS[order.status] || order.status}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2"
                        >
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
                            {item.products?.image_url ? (
                              <Image
                                src={item.products.image_url}
                                alt={item.products.title || "Ürün"}
                                fill
                                className="object-cover"
                                sizes="44px"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {item.products?.title || "Ürün"}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {item.quantity} adet ·{" "}
                              {formatPrice(item.unit_earning)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold">
                            {formatPrice(
                              Number(item.unit_earning || 0) *
                                Number(item.quantity || 0)
                            )}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-sm">
                      <span className="text-zinc-500">
                        {formatDate(order.created_at)}
                      </span>
                      <span className="font-semibold text-emerald-600">
                        {formatPrice(order.producer_earning)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div ref={sentinelRef} className="h-4" />
          {ordersLoading ? (
            <p className="text-center text-sm text-zinc-400">
              Daha fazla yükleniyor...
            </p>
          ) : null}
          {!hasMoreOrders && orders.length > 0 ? (
            <p className="text-center text-xs text-zinc-400">
              Tüm siparişler yüklendi
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "urunler" ? (
        <form onSubmit={saveProducts} className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold">Ürün Ataması</h2>
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Ürün ara"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm sm:max-w-xs"
              />
            </div>
            <div className="mt-4 space-y-2">
              {sortedProducts.map((p) => {
                const assign = assignments[p.id] || {
                  isActive: false,
                  stockQuantity: 0,
                };
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:flex-wrap sm:items-center ${
                      assign.isActive
                        ? "border-orange-200 bg-orange-50"
                        : "border-zinc-100 bg-zinc-50"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.title}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          {p.title}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {p.brand_name || "Manuel ürün"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={assign.isActive}
                          onChange={(e) =>
                            updateAssignment(p.id, {
                              isActive: e.target.checked,
                            })
                          }
                          className="h-5 w-5"
                        />
                        Üretiyor
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500">Stok</span>
                        <input
                          type="number"
                          min="0"
                          value={assign.stockQuantity}
                          onChange={(e) =>
                            updateAssignment(p.id, {
                              stockQuantity: e.target.value,
                            })
                          }
                          className="w-20 rounded-lg border px-2 py-1.5"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {saving ? "Kaydediliyor..." : "Ürünleri Kaydet"}
          </button>
        </form>
      ) : null}

      {tab === "ayarlar" ? (
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
            <h2 className="font-semibold">Profil Bilgileri</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Ad Soyad</span>
                <input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Telefon</span>
                <PhoneInput
                  required
                  value={form.phone}
                  onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Şehir</span>
                <input
                  value={form.city}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">İlçe</span>
                <input
                  value={form.district}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, district: e.target.value }))
                  }
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-zinc-500">IBAN</span>
                <input
                  value={form.iban}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, iban: e.target.value }))
                  }
                  placeholder="TR.."
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                <span>Hesap aktif</span>
              </label>
            </div>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-zinc-500">
                Admin notu (sadece admin görür)
              </span>
              <textarea
                value={form.adminNote}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, adminNote: e.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border px-3 py-2.5"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
            <h2 className="font-semibold">Şifre</h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">Mevcut şifre</p>
                <p className="font-mono text-sm">
                  {showPassword
                    ? producer.decrypted_password || "Şifre çözülemedi"
                    : "••••••••"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-lg border px-3 py-2 text-xs font-medium"
                >
                  {showPassword ? "Gizle" : "Şifreyi Göster"}
                </button>
                <button
                  type="button"
                  onClick={openPasswordModal}
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white"
                >
                  Şifre Değiştir
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </form>
      ) : null}

      {passwordModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Şifre Değiştir</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {producer.full_name || producer.username} için yeni şifre
                  belirleyin
                </p>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Yeni şifre</span>
              <input
                type="text"
                autoFocus
                value={modalPassword}
                onChange={(e) => setModalPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Yeni şifreyi yazın"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={passwordSaving}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={updatePassword}
                disabled={passwordSaving || !modalPassword.trim()}
                className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {passwordSaving ? "Güncelleniyor..." : "Şifre Güncelle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
