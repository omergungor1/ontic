"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice, PRODUCER_ORDER_STATUS } from "@/lib/format";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

const EMPTY_SETTINGS = {
  sales_vat_rate: "",
  commission_vat_rate: "",
  cargo_price: "",
  cargo_vat_rate: "",
  platform_service_fee: "",
  platform_service_fee_vat_rate: "",
  income_tax_rate: "",
};

function GearIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" {...props}>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminCashPage() {
  const [from, setFrom] = useState(monthAgoIso());
  const [to, setTo] = useState(todayIso());
  const [listType, setListType] = useState("all");
  const [producerId, setProducerId] = useState("");
  const [producers, setProducers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [producerOrders, setProducerOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    income: 0,
    expense: 0,
    producerEarnings: 0,
    balance: 0,
    netProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ producerId: "", amount: "", note: "" });
  const [saving, setSaving] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState(EMPTY_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  async function loadProducers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .eq("role", "producer")
      .order("full_name", { ascending: true });
    setProducers(data || []);
  }

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }
      if (producerId) params.set("producerId", producerId);

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kasa verisi alınamadı");
      setPayments(data.payments || []);
      setProducerOrders(data.producerOrders || []);
      setOrders(data.orders || []);
      setSummary(
        data.summary || {
          income: 0,
          expense: 0,
          producerEarnings: 0,
          balance: 0,
          netProfit: 0,
        }
      );
      if (data.settings) {
        setSettingsForm({
          sales_vat_rate: String(data.settings.sales_vat_rate ?? ""),
          commission_vat_rate: String(data.settings.commission_vat_rate ?? ""),
          cargo_price: String(data.settings.cargo_price ?? ""),
          cargo_vat_rate: String(data.settings.cargo_vat_rate ?? ""),
          platform_service_fee: String(data.settings.platform_service_fee ?? ""),
          platform_service_fee_vat_rate: String(
            data.settings.platform_service_fee_vat_rate ?? ""
          ),
          income_tax_rate: String(data.settings.income_tax_rate ?? ""),
        });
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducers();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, producerId]);

  const timeline = useMemo(() => {
    const items = [];

    if (listType === "all" || listType === "payment") {
      for (const p of payments) {
        items.push({
          id: `payment-${p.id}`,
          kind: "payment",
          date: p.paid_at,
          producerName: p.profiles?.full_name || "-",
          amount: Number(p.amount || 0),
          note: p.note || "",
          meta: null,
        });
      }
    }

    if (listType === "all" || listType === "order") {
      for (const po of producerOrders) {
        items.push({
          id: `order-${po.id}`,
          kind: "order",
          date: po.created_at,
          producerName: po.profiles?.full_name || "-",
          amount: Number(po.producer_earning || 0),
          note: "",
          meta: {
            orderNumber: po.trendyol_orders?.order_number || "-",
            status: po.status,
          },
        });
      }
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return items;
  }, [payments, producerOrders, listType]);

  async function openSettings() {
    setSettingsError("");
    setSettingsOpen(true);
    try {
      const res = await fetch("/api/admin/financial-settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ayarlar yüklenemedi");
      const s = data.settings || {};
      setSettingsForm({
        sales_vat_rate: String(s.sales_vat_rate ?? ""),
        commission_vat_rate: String(s.commission_vat_rate ?? ""),
        cargo_price: String(s.cargo_price ?? ""),
        cargo_vat_rate: String(s.cargo_vat_rate ?? ""),
        platform_service_fee: String(s.platform_service_fee ?? ""),
        platform_service_fee_vat_rate: String(
          s.platform_service_fee_vat_rate ?? ""
        ),
        income_tax_rate: String(s.income_tax_rate ?? ""),
      });
    } catch (err) {
      setSettingsError(err.message);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(settingsForm).map(([key, value]) => [key, Number(value)])
      );
      const res = await fetch("/api/admin/financial-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ayarlar kaydedilemedi");
      setSettingsOpen(false);
      await load();
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function submitPayment(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producerId: form.producerId,
          amount: Number(form.amount),
          note: form.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ödeme kaydedilemedi");
      setFormOpen(false);
      setForm({ producerId: "", amount: "", note: "" });
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  const listTitle =
    listType === "payment"
      ? "Ödemeler"
      : listType === "order"
        ? "Üretici sipariş kazançları"
        : listType === "profit"
          ? "Trendyol siparişleri — net kâr"
          : "Timeline";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kasa Yönetimi</h1>
          <p className="text-zinc-500">Gelir, gider ve ödeme takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSettings}
            aria-label="Finansal ayarlar"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          >
            <GearIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white"
          >
            + Ödeme ekle
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Başlangıç</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Bitiş</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Liste</span>
          <select
            value={listType}
            onChange={(e) => setListType(e.target.value)}
            className="rounded-lg border px-2 py-1.5"
          >
            <option value="all">Tümü</option>
            <option value="payment">Ödeme</option>
            <option value="order">Sipariş</option>
            <option value="profit">Kar</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Üretici</span>
          <select
            value={producerId}
            onChange={(e) => setProducerId(e.target.value)}
            className="rounded-lg border px-2 py-1.5"
          >
            <option value="">Tümü</option>
            {producers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message ? <p className="text-sm text-rose-600">{message}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Gelir (Trendyol net tutar)</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {formatPrice(summary.income)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Gider (Üretici ödemeleri)</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">
            {formatPrice(summary.expense)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Üretici sipariş kazançları</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">
            {formatPrice(summary.producerEarnings)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Bakiye</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatPrice(summary.balance)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-700">Gerçek net kâr</p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              Number(summary.netProfit) >= 0
                ? "text-emerald-700"
                : "text-rose-600"
            }`}
          >
            {formatPrice(summary.netProfit)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{listTitle}</h2>
        {loading ? (
          <p>Yükleniyor...</p>
        ) : listType === "profit" ? (
          orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
              Bu aralıkta sipariş yok
            </p>
          ) : (
            <div className="overflow-x-auto overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Sipariş</th>
                    <th className="px-4 py-3">Satış</th>
                    <th className="px-4 py-3">Komisyon</th>
                    <th className="px-4 py-3">Kargo+PHB</th>
                    <th className="px-4 py-3">Ürün maliyeti</th>
                    <th className="px-4 py-3">Trendyol net</th>
                    <th className="px-4 py-3">Net kâr</th>
                    <th className="px-4 py-3">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const p = order.profit;
                    return (
                      <tr key={order.id} className="border-t border-zinc-100">
                        <td className="px-4 py-3">
                          <p className="font-medium">{order.order_number}</p>
                          <p className="text-xs text-zinc-500">
                            {order.customer_first_name}{" "}
                            {order.customer_last_name}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {formatPrice(p?.salesGross)}
                          <p className="text-[11px] text-zinc-400">
                            KDV hariç {formatPrice(p?.salesNet)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-rose-600">
                          -{formatPrice(p?.commission)}
                        </td>
                        <td className="px-4 py-3 text-rose-600">
                          -
                          {formatPrice(
                            Number(p?.cargo || 0) + Number(p?.platformFee || 0)
                          )}
                        </td>
                        <td className="px-4 py-3 text-rose-600">
                          -{formatPrice(p?.productCost)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {formatPrice(order.net_amount)}
                        </td>
                        <td
                          className={`px-4 py-3 font-semibold ${
                            Number(p?.netProfit || 0) >= 0
                              ? "text-emerald-700"
                              : "text-rose-600"
                          }`}
                        >
                          {formatPrice(p?.netProfit)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {formatDate(order.order_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : timeline.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            Bu aralıkta kayıt yok
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Tür</th>
                  <th className="px-4 py-3">Üretici</th>
                  <th className="px-4 py-3">Detay</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.kind === "payment"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {item.kind === "payment" ? "Ödeme" : "Sipariş"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {item.producerName}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {item.kind === "payment"
                        ? item.note || "-"
                        : `${item.meta?.orderNumber || "-"} · ${
                            PRODUCER_ORDER_STATUS[item.meta?.status] ||
                            item.meta?.status ||
                            "-"
                          }`}
                    </td>
                    <td className="px-4 py-3 font-medium text-rose-600">
                      {item.kind === "payment" ? "-" : ""}
                      {formatPrice(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatDate(item.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={submitPayment}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5"
          >
            <h3 className="text-lg font-semibold">Yeni Ödeme</h3>
            <select
              required
              value={form.producerId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, producerId: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            >
              <option value="">Üretici seç</option>
              {producers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} (@{p.username})
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              step="0.01"
              placeholder="Tutar (₺)"
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <textarea
              placeholder="Not (opsiyonel)"
              value={form.note}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, note: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex-1 rounded-xl border py-2"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-orange-600 py-2 text-white disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <form
            onSubmit={saveSettings}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-[85vh] sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-lg font-semibold">Finansal Ayarlar</h3>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Net kâr formülündeki değişkenler
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg px-2 py-1 text-xl text-zinc-500"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              {[
                {
                  key: "sales_vat_rate",
                  label: "Satış KDV Oranı (%)",
                },
                {
                  key: "commission_vat_rate",
                  label: "Komisyon KDV Oranı (%)",
                },
                {
                  key: "cargo_price",
                  label: "Kargo Ücreti (TL)",
                },
                {
                  key: "cargo_vat_rate",
                  label: "Kargo KDV Oranı (%)",
                },
                {
                  key: "platform_service_fee",
                  label: "Platform Hizmet Bedeli (TL)",
                },
                {
                  key: "platform_service_fee_vat_rate",
                  label: "Platform Hizmet Bedeli KDV Oranı (%)",
                },
                {
                  key: "income_tax_rate",
                  label: "Gelir Vergisi Oranı (%)",
                },
              ].map((field) => (
                <label key={field.key} className="block text-sm">
                  <span className="mb-1 block text-zinc-500">{field.label}</span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={settingsForm[field.key]}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
                  />
                </label>
              ))}
              {settingsError ? (
                <p className="text-sm text-rose-600">{settingsError}</p>
              ) : null}
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-zinc-100 px-4 py-4 sm:px-5">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                disabled={settingsSaving}
                className="rounded-xl border border-zinc-200 py-3 text-sm font-medium"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={settingsSaving}
                className="rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
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
