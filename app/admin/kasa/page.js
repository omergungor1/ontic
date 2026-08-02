"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPrice } from "@/lib/format";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function AdminCashPage() {
  const [from, setFrom] = useState(monthAgoIso());
  const [to, setTo] = useState(todayIso());
  const [producerId, setProducerId] = useState("");
  const [producers, setProducers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ producerId: "", amount: "", note: "" });
  const [saving, setSaving] = useState(false);

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
      setSummary(
        data.summary || { income: 0, expense: 0, balance: 0 }
      );
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kasa Yönetimi</h1>
          <p className="text-zinc-500">Gelir, gider ve ödeme takibi</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white"
        >
          + Ödeme ekle
        </button>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Gelir (Sipariş net tutarı)</p>
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
          <p className="text-xs text-zinc-500">Bakiye</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatPrice(summary.balance)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Ödemeler</h2>
        {loading ? (
          <p>Yükleniyor...</p>
        ) : payments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            Bu aralıkta ödeme kaydı yok
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Üretici</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Not</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      {p.profiles?.full_name || "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-rose-600">
                      -{formatPrice(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {p.note || "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatDate(p.paid_at)}
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
    </div>
  );
}
