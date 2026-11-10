"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AnnouncementSlider from "@/components/AnnouncementSlider";
import PhoneInput from "@/components/PhoneInput";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, PRODUCER_ORDER_STATUS } from "@/lib/format";
import { formatPhoneInput, isValidTrMobile } from "@/lib/phone";
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

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
      />
      <path
        d="M19.4 13.5a7.8 7.8 0 0 0 .1-1.5 7.8 7.8 0 0 0-.1-1.5l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2h-4l-.4 2.5a7.4 7.4 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5a7.8 7.8 0 0 0-.1 1.5 7.8 7.8 0 0 0 .1 1.5l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 2.6 1.5L10 22h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const emptySettings = {
  fullName: "",
  phone: "",
  city: "",
  district: "",
  iban: "",
  email: "",
};

export default function ProducerHomePage() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [totalStock, setTotalStock] = useState(0);
  const [remainingPayment, setRemainingPayment] = useState(0);
  const [fullName, setFullName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(emptySettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
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

      const { data: announcementRows } = await supabase
        .from("announcements")
        .select("id, title, description, image_url")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      const { data: orders } = await supabase
        .from("producer_orders")
        .select(
          "*, producer_order_items(*, products!product_id(title)), trendyol_orders!trendyol_order_id(order_number, customer_first_name, customer_last_name)"
        )
        .eq("producer_id", user.id)
        .not("status", "in", '("completed","cancelled","rejected","shipped")')
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
        .not("status", "in", '("cancelled","rejected")');

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

      setAnnouncements(announcementRows || []);
      setActiveOrders(orders || []);
      setTotalStock(stockSum);
      setRemainingPayment(totalEarned - totalPaid);
      setLoading(false);
    }
    load();
  }, []);

  async function openSettings() {
    setSettingsOpen(true);
    setSettingsError("");
    setSettingsMessage("");
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/uretici/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Profil yüklenemedi");
      setSettings({
        fullName: data.profile?.full_name || "",
        phone: data.profile?.phone
          ? formatPhoneInput(data.profile.phone)
          : "",
        city: data.profile?.city || "",
        district: data.profile?.district || "",
        iban: data.profile?.iban || "",
        email: data.profile?.email || "",
      });
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      if (!isValidTrMobile(settings.phone)) {
        throw new Error("Telefon 05XX XXX XX XX formatında olmalıdır");
      }
      const res = await fetch("/api/uretici/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");
      setFullName(settings.fullName.trim());
      setSettingsMessage("Ayarlar kaydedildi");
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  if (loading) return <p className="text-lg text-zinc-500">Yükleniyor...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            Merhaba{fullName ? `, ${fullName}` : ""} 👋
          </h1>
          <p className="text-zinc-500">Ontic üretici paneline hoş geldiniz</p>
        </div>
        <button
          type="button"
          onClick={openSettings}
          aria-label="Ayarlar"
          title="Ayarlar"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900"
        >
          <SettingsIcon />
        </button>
      </div>

      <AnnouncementSlider items={announcements} />

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

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <form
            onSubmit={saveSettings}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="producer-settings-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="producer-settings-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Ayarlar
                </h3>
                <p className="text-sm text-zinc-500">
                  Profil bilgilerinizi güncelleyin
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>

            {settingsLoading ? (
              <p className="mt-6 text-sm text-zinc-500">Yükleniyor...</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-zinc-500">Ad Soyad</span>
                  <input
                    required
                    value={settings.fullName}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-zinc-500">Telefon</span>
                  <PhoneInput
                    required
                    value={settings.phone}
                    onChange={(phone) =>
                      setSettings((prev) => ({ ...prev, phone }))
                    }
                    className="w-full rounded-xl border px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-500">Şehir</span>
                  <input
                    value={settings.city}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-500">İlçe</span>
                  <input
                    value={settings.district}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        district: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-zinc-500">IBAN</span>
                  <input
                    value={settings.iban}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        iban: e.target.value,
                      }))
                    }
                    placeholder="TR.."
                    className="w-full rounded-xl border px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-zinc-500">E-posta</span>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="ornek@email.com"
                    className="w-full rounded-xl border px-3 py-2.5"
                  />
                </label>
              </div>
            )}

            {settingsError ? (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {settingsError}
              </p>
            ) : null}
            {settingsMessage ? (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {settingsMessage}
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl border border-zinc-200 py-2.5 text-sm font-medium"
              >
                Kapat
              </button>
              <button
                type="submit"
                disabled={settingsLoading || settingsSaving}
                className="rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {settingsSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
