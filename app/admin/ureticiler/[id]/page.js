"use client";

import Link from "next/link";
import StorageImage from "@/components/StorageImage";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PhoneInput from "@/components/PhoneInput";
import BackButton from "@/components/BackButton";
import ProducerPerformancePanel, {
  fetchProducerAnalytics,
} from "@/components/ProducerPerformancePanel";
import ProducerAnalysisModal from "@/components/ProducerAnalysisModal";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, PRODUCER_ORDER_STATUS } from "@/lib/format";
import {
  normalizePersonMultiplier,
  sendQuantity,
} from "@/lib/person-multiplier";
import { formatPhoneInput, isValidTrMobile } from "@/lib/phone";

const TABS = [
  { key: "ayarlar", label: "Ayarlar" },
  { key: "performans", label: "Performans" },
  { key: "siparisler", label: "Siparişler" },
  { key: "urunler", label: "Ürettiği Ürünler" },
];

const PERF_RANGES = [
  { key: "7", label: "7 gün", days: 7 },
  { key: "14", label: "14 gün", days: 14 },
  { key: "30", label: "30 gün", days: 30 },
  { key: "90", label: "90 gün", days: 90 },
];

const ORDERS_PAGE_SIZE = 10;

const PRODUCT_SORT_OPTIONS = [
  { value: "producing-first", label: "Üretenler üstte" },
  { value: "name-asc", label: "İsim (A → Z)" },
  { value: "name-desc", label: "İsim (Z → A)" },
  { value: "stock-desc", label: "Stok (azalan)" },
  { value: "stock-asc", label: "Stok (artan)" },
];

const PRODUCING_FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "producing", label: "Üretiyor" },
  { value: "not_producing", label: "Üretmiyor" },
];

function PersonIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z"
        strokeLinejoin="round"
      />
      <path d="m13.5 6.5 3 3" strokeLinecap="round" />
    </svg>
  );
}

function PersonMultiplierField({ value, editing, onToggleEdit, onChange }) {
  const count = normalizePersonMultiplier(value);
  const overFive = count > 5;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {editing ? (
        <input
          type="number"
          min="1"
          max="999"
          step="1"
          inputMode="numeric"
          required
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Kişi çarpanı"
          className="w-24 rounded-xl border px-3 py-2.5"
        />
      ) : overFive ? (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-800">
          <PersonIcon className="h-5 w-5 text-orange-600" />
          <span className="text-sm font-semibold tabular-nums">{count}</span>
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 5 }, (_, index) => {
            const personCount = index + 1;
            const active = personCount <= count;
            return (
              <button
                key={personCount}
                type="button"
                aria-label={`${personCount} kişi`}
                aria-pressed={personCount === count}
                onClick={() => onChange(personCount)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                  active
                    ? "border-orange-200 bg-orange-50 text-orange-600"
                    : "border-zinc-200 bg-white text-zinc-300 hover:border-zinc-300 hover:text-zinc-500"
                }`}
              >
                <PersonIcon />
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={onToggleEdit}
        aria-label={editing ? "Kişi seçimine dön" : "Kişi çarpanını yaz"}
        title={editing ? "Kişi seçimine dön" : "Elle yaz"}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
          editing
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
        }`}
      >
        <PencilIcon />
      </button>
    </div>
  );
}

function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" {...props}>
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" />
    </svg>
  );
}

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
  const searchParams = useSearchParams();
  const producerId = params?.id;

  const [tab, setTab] = useState("ayarlar");
  const [producer, setProducer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [modalPassword, setModalPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [multiplierEditing, setMultiplierEditing] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    city: "",
    district: "",
    iban: "",
    email: "",
    adminNote: "",
    personMultiplier: 1,
    maxOpenOrders: "",
    isActive: true,
  });

  const [products, setProducts] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [pinnedActiveIds, setPinnedActiveIds] = useState({});
  const [pinnedStockById, setPinnedStockById] = useState({});
  const [productSearch, setProductSearch] = useState("");
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [producingFilter, setProducingFilter] = useState("all");
  const [productSortBy, setProductSortBy] = useState("producing-first");
  const [stockHistoryOpen, setStockHistoryOpen] = useState(false);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  const [stockHistoryError, setStockHistoryError] = useState("");
  const [stockHistory, setStockHistory] = useState(null);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersBootstrapping, setOrdersBootstrapping] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const ordersOffset = useRef(0);
  const ordersLoadingRef = useRef(false);
  const sentinelRef = useRef(null);

  const [perfRange, setPerfRange] = useState("30");
  const [perfStats, setPerfStats] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState("");

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
        email: data.producer.email || "",
        adminNote: data.producer.admin_note || "",
        personMultiplier: normalizePersonMultiplier(
          data.producer.person_multiplier
        ),
        maxOpenOrders:
          data.producer.max_open_orders == null
            ? ""
            : String(data.producer.max_open_orders),
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

      const pinned = {};
      const pinnedStock = {};
      for (const [productId, val] of Object.entries(assignMap)) {
        if (val.isActive) pinned[productId] = true;
        pinnedStock[productId] = Number(val.stockQuantity || 0);
      }

      setProducts(allProducts || []);
      setAssignments(assignMap);
      setPinnedActiveIds(pinned);
      setPinnedStockById(pinnedStock);
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
    const requested = searchParams.get("tab");
    if (TABS.some((item) => item.key === requested)) {
      setTab(requested);
    }
  }, [searchParams]);

  useEffect(() => {
    if (tab !== "siparisler" || !producerId) return;
    loadOrders({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, producerId]);

  useEffect(() => {
    if (tab !== "performans" || !producerId) return undefined;
    let cancelled = false;
    async function loadPerf() {
      setPerfLoading(true);
      setPerfError("");
      try {
        const range = PERF_RANGES.find((item) => item.key === perfRange);
        const data = await fetchProducerAnalytics({
          producerId,
          days: range?.days ?? 30,
        });
        if (cancelled) return;
        setPerfStats(data.producers?.[0] || null);
      } catch (err) {
        if (!cancelled) {
          setPerfError(err.message);
          setPerfStats(null);
        }
      } finally {
        if (!cancelled) setPerfLoading(false);
      }
    }
    loadPerf();
    return () => {
      cancelled = true;
    };
  }, [tab, producerId, perfRange]);

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

  async function openStockHistory(product) {
    if (!producerId || !product?.id) return;
    setStockHistoryOpen(true);
    setStockHistoryLoading(true);
    setStockHistoryError("");
    setStockHistory({
      productTitle: product.title || "Ürün",
      logs: [],
    });
    try {
      const params = new URLSearchParams({
        producerId,
        productId: product.id,
      });
      const res = await fetch(`/api/admin/stock-logs?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stok geçmişi alınamadı");
      setStockHistory({
        productTitle: data.product?.title || product.title || "Ürün",
        logs: data.logs || [],
      });
    } catch (err) {
      setStockHistoryError(err.message);
    } finally {
      setStockHistoryLoading(false);
    }
  }

  const productFilterActive =
    Boolean(productSearch.trim()) ||
    producingFilter !== "all" ||
    productSortBy !== "producing-first";

  const sortedProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase("tr");
    let list = products;

    if (term) {
      list = list.filter((p) =>
        String(p.title || "")
          .toLocaleLowerCase("tr")
          .includes(term)
      );
    }

    if (producingFilter === "producing") {
      list = list.filter((p) => assignments[p.id]?.isActive);
    } else if (producingFilter === "not_producing") {
      list = list.filter((p) => !assignments[p.id]?.isActive);
    }

    return [...list].sort((a, b) => {
      // Stok sıralaması yüklenen değere göre — yazarken liste zıplamasın
      const stockA = Number(pinnedStockById[a.id] || 0);
      const stockB = Number(pinnedStockById[b.id] || 0);
      const nameA = a.title || "";
      const nameB = b.title || "";

      switch (productSortBy) {
        case "name-asc":
          return nameA.localeCompare(nameB, "tr");
        case "name-desc":
          return nameB.localeCompare(nameA, "tr");
        case "stock-asc":
          return stockA - stockB;
        case "stock-desc":
          return stockB - stockA;
        case "producing-first":
        default: {
          // Sıralama kayıtlı (yüklenen) duruma göre — checkbox ile anlık yer değiştirmez
          const aActive = pinnedActiveIds[a.id] ? 1 : 0;
          const bActive = pinnedActiveIds[b.id] ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          return nameA.localeCompare(nameB, "tr");
        }
      }
    });
  }, [
    products,
    assignments,
    pinnedActiveIds,
    pinnedStockById,
    productSearch,
    producingFilter,
    productSortBy,
  ]);

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
      setMultiplierEditing(false);
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
    setShowPassword(false);
    setPasswordCopied(false);
    setError("");
    setPasswordModalOpen(true);
  }

  function closePasswordModal() {
    if (passwordSaving) return;
    setPasswordModalOpen(false);
    setModalPassword("");
    setShowPassword(false);
    setPasswordCopied(false);
  }

  async function copyCurrentPassword() {
    const value = producer?.decrypted_password;
    if (!value) {
      setError("Kopyalanacak şifre yok");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setPasswordCopied(true);
      window.setTimeout(() => setPasswordCopied(false), 1500);
    } catch {
      setError("Şifre kopyalanamadı");
    }
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
        <div className="flex min-w-0 items-center gap-3">
          <BackButton
            onClick={() => router.push("/admin/ureticiler")}
            label="Üreticilere dön"
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">
              {producer.full_name}
            </h1>
            <p className="flex min-w-0 items-center gap-2 text-zinc-500">
              <span className="truncate">@{producer.username}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-zinc-700">
                <PersonIcon className="h-4 w-4" />
                <span className="text-sm font-medium tabular-nums">
                  × {normalizePersonMultiplier(producer.person_multiplier)}
                </span>
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setAnalysisOpen(true)}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700"
          >
            Analiz
          </button>
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
      </div>

      <ProducerAnalysisModal
        producer={analysisOpen ? producer : null}
        onClose={() => setAnalysisOpen(false)}
      />

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
                              <StorageImage
                                src={item.products.image_url}
                                alt={item.products.title || "Ürün"}
                                fill
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
                            {normalizePersonMultiplier(
                              producer.person_multiplier
                            ) > 1 ? (
                              <p className="text-xs font-medium text-orange-700">
                                Gönderilecek{" "}
                                {sendQuantity(
                                  item.quantity,
                                  producer.person_multiplier
                                )}{" "}
                                adet
                              </p>
                            ) : null}
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

      {tab === "performans" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PERF_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => setPerfRange(range.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  perfRange === range.key
                    ? "bg-orange-600 text-white"
                    : "bg-zinc-100 text-zinc-700"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          {perfError ? (
            <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {perfError}
            </p>
          ) : null}
          <ProducerPerformancePanel
            stats={perfStats}
            loading={perfLoading}
            emptyText="Bu üretici için seçili dönemde veri yok"
          />
        </div>
      ) : null}

      {tab === "urunler" ? (
        <form onSubmit={saveProducts} className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold">Ürün Ataması</h2>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Ürün ara"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm sm:w-56"
                />
                <button
                  type="button"
                  onClick={() => setProductFilterOpen((open) => !open)}
                  aria-expanded={productFilterOpen}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition sm:shrink-0 ${
                    productFilterOpen || productFilterActive
                      ? "border-orange-300 bg-orange-50 text-orange-700"
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  Filtre{productFilterOpen ? " ▴" : " ▾"}
                </button>
              </div>
            </div>

            {productFilterOpen ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-xs font-medium text-zinc-500">
                      Üretim durumu
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PRODUCING_FILTERS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setProducingFilter(option.value)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                            producingFilter === option.value
                              ? "bg-orange-600 text-white"
                              : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-zinc-500">
                      Sıralama
                    </span>
                    <select
                      value={productSortBy}
                      onChange={(e) => setProductSortBy(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
                    >
                      {PRODUCT_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {productFilterActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch("");
                      setProducingFilter("all");
                      setProductSortBy("producing-first");
                    }}
                    className="mt-3 text-sm font-medium text-orange-700 hover:underline"
                  >
                    Filtreleri temizle
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {sortedProducts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-8 text-center text-sm text-zinc-500">
                  Filtreye uygun ürün yok
                </p>
              ) : null}
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
                          <StorageImage
                            src={p.image_url}
                            alt={p.title}
                            fill
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
                      <button
                        type="button"
                        onClick={() => openStockHistory(p)}
                        aria-label="Stok geçmişini gör"
                        title="Stok geçmişi"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
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

      {stockHistoryOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-history-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <div className="min-w-0">
                <h3
                  id="stock-history-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Stok geçmişi
                </h3>
                <p className="mt-0.5 truncate text-sm text-zinc-500">
                  {stockHistory?.productTitle || "Ürün"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStockHistoryOpen(false)}
                className="rounded-full px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {stockHistoryLoading ? (
                <p className="text-sm text-zinc-500">Yükleniyor...</p>
              ) : stockHistoryError ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {stockHistoryError}
                </p>
              ) : !stockHistory?.logs?.length ? (
                <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-8 text-center text-sm text-zinc-500">
                  Bu ürün için stok hareketi yok
                </p>
              ) : (
                stockHistory.logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-800">
                          {log.sourceLabel}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {formatDate(log.createdAt)}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-sm font-semibold ${
                          log.delta >= 0 ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {log.delta > 0 ? "+" : ""}
                        {log.delta}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      {log.previousQuantity} → {log.newQuantity} adet
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "ayarlar" ? (
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Profil Bilgileri</h2>
              <button
                type="button"
                onClick={openPasswordModal}
                aria-label="Şifre"
                title="Şifre"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M7 11V8a5 5 0 0 1 10 0v3"
                    stroke="currentColor"
                    strokeLinecap="round"
                  />
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="2"
                    stroke="currentColor"
                  />
                </svg>
              </button>
            </div>
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
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">E-posta</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="ornek@email.com"
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
              <label className="block text-sm">
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
              <div className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-zinc-500">Kişi çarpanı</span>
                <PersonMultiplierField
                  value={form.personMultiplier}
                  editing={multiplierEditing}
                  onToggleEdit={() => setMultiplierEditing((open) => !open)}
                  onChange={(personMultiplier) =>
                    setForm((prev) => ({ ...prev, personMultiplier }))
                  }
                />
                <span className="mt-1 block text-xs text-zinc-400">
                  Bu hesabı aynı anda kaç kişi kullanıyor. Sipariş adedi bu
                  sayıyla çarpılarak gönderilecek miktar hesaplanır. Varsayılan
                  1. Kazancı değiştirmez.
                </span>
              </div>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-zinc-500">
                  Açık sipariş limiti
                </span>
                <input
                  type="number"
                  min="1"
                  value={form.maxOpenOrders}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      maxOpenOrders: e.target.value,
                    }))
                  }
                  placeholder="Limitsiz"
                  className="w-full rounded-xl border px-3 py-2.5"
                />
                <span className="mt-1 block text-xs text-zinc-400">
                  Kargolanmamış sipariş bu sayıya ulaşınca oto dağıtım yeni iş
                  vermez. Boş bırakılırsa sınır yoktur.
                </span>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Şifre</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {producer.full_name || producer.username}
                </p>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={passwordSaving}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Mevcut şifre</p>
                  <p className="mt-0.5 break-all font-mono text-sm text-zinc-900">
                    {showPassword
                      ? producer.decrypted_password || "Şifre çözülemedi"
                      : "••••••••"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={copyCurrentPassword}
                    aria-label="Şifreyi kopyala"
                    title={passwordCopied ? "Kopyalandı" : "Kopyala"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                  >
                    {passwordCopied ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth="2"
                        className="h-4 w-4 text-emerald-600"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="11"
                          height="11"
                          rx="2"
                          stroke="currentColor"
                        />
                        <path
                          d="M5 15V5a2 2 0 0 1 2-2h10"
                          stroke="currentColor"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium"
                  >
                    {showPassword ? "Gizle" : "Göster"}
                  </button>
                </div>
              </div>
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
                className="w-full rounded-xl border px-3 py-2.5"
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
                Kapat
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
