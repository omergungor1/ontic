"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate, formatPrice } from "@/lib/format";

const emptyForm = {
  title: "",
  startDate: "",
  endDate: "",
  targetStock: "",
  rewardAmount: "",
  isActive: true,
};

function toInputDate(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function campaignStatus(campaign) {
  const now = Date.now();
  const start = new Date(campaign.starts_at).getTime();
  const end = new Date(campaign.ends_at).getTime();
  if (!campaign.is_active) return { label: "Pasif", className: "bg-zinc-100 text-zinc-600" };
  if (now < start) return { label: "Beklemede", className: "bg-amber-100 text-amber-800" };
  if (now > end) return { label: "Bitti", className: "bg-zinc-100 text-zinc-600" };
  return { label: "Aktif", className: "bg-emerald-100 text-emerald-700" };
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/campaigns");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yüklenemedi");
      setCampaigns(data.campaigns || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(campaign) {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title || "",
      startDate: toInputDate(campaign.starts_at),
      endDate: toInputDate(campaign.ends_at),
      targetStock: String(campaign.target_stock || ""),
      rewardAmount: String(campaign.reward_amount || ""),
      isActive: Boolean(campaign.is_active),
    });
    setFormOpen(true);
  }

  async function saveForm(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        title: form.title,
        startDate: form.startDate,
        endDate: form.endDate,
        targetStock: form.targetStock,
        rewardAmount: form.rewardAmount,
        isActive: form.isActive,
      };
      const res = await fetch(
        editingId ? `/api/admin/campaigns/${editingId}` : "/api/admin/campaigns",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");
      setFormOpen(false);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Silinemedi");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kampanyalar</h1>
          <p className="text-zinc-500">
            Stok ekleme hedefli üretici kampanyaları
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          + Kampanya ekle
        </button>
      </div>

      {message ? (
        <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {message}
        </p>
      ) : null}

      <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Kampanya döneminde üreticinin <strong>manuel</strong> stok artışı (+) ve
        elle azaltması (−) sayılır. Kargolama stok düşümü kampanyaya dahil
        edilmez. Her üretici bir kampanyadan yalnızca bir kez yararlanabilir.
      </div>

      {loading ? (
        <p className="text-zinc-500">Yükleniyor...</p>
      ) : campaigns.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Henüz kampanya yok
        </p>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const status = campaignStatus(campaign);
            return (
              <div
                key={campaign.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">
                        {campaign.title || "İsimsiz kampanya"}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                      {campaign.pendingClaims > 0 ? (
                        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                          {campaign.pendingClaims} onay bekliyor
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatDate(campaign.starts_at)} —{" "}
                      {formatDate(campaign.ends_at)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      Hedef:{" "}
                      <strong>{campaign.target_stock} adet</strong> net stok ·
                      Ödül:{" "}
                      <strong>{formatPrice(campaign.reward_amount)}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/kampanyalar/${campaign.id}`}
                      className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
                    >
                      Detay
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEdit(campaign)}
                      className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(campaign)}
                      className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={saveForm}
            className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold">
              {editingId ? "Kampanyayı düzenle" : "Yeni kampanya"}
            </h3>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">
                Kampanya adı (isteğe bağlı)
              </span>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Örn. Mart stok yarışı"
                className="w-full rounded-xl border px-3 py-2.5"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Başlangıç</span>
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Bitiş</span>
                <input
                  required
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Hedef stok (adet)</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={form.targetStock}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      targetStock: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Kampanya ödülü ₺</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rewardAmount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      rewardAmount: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-3 py-2.5"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="h-4 w-4"
              />
              Aktif
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Kampanyayı sil</h3>
            <p className="mt-2 text-sm text-zinc-600">
              “{deleteTarget.title || "İsimsiz kampanya"}” silinecek. Onay
              kayıtları da kalkar.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border py-2.5 text-sm"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {deleting ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
