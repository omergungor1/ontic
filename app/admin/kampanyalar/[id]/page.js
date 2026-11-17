"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import StorageImage from "@/components/StorageImage";
import { formatDate, formatPrice } from "@/lib/format";

function claimLabel(status) {
  switch (status) {
    case "pending":
      return { text: "Onay bekliyor", className: "bg-amber-100 text-amber-800" };
    case "approved":
      return { text: "Onaylandı", className: "bg-emerald-100 text-emerald-700" };
    case "rejected":
      return { text: "Reddedildi", className: "bg-rose-100 text-rose-700" };
    default:
      return { text: "—", className: "bg-zinc-100 text-zinc-600" };
  }
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

export default function AdminCampaignDetailPage() {
  const params = useParams();
  const campaignId = params?.id;
  const [campaign, setCampaign] = useState(null);
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [actingId, setActingId] = useState("");

  const [stockModal, setStockModal] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);

  async function load() {
    if (!campaignId) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yüklenemedi");
      setCampaign(data.campaign);
      setProducers(data.producers || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  function openConfirm(row, action) {
    setConfirmModal({
      claimId: row.claim?.id,
      action,
      producerName: row.profile?.full_name || "Üretici",
      netStockAdded: row.netStockAdded,
    });
  }

  async function confirmAct() {
    if (!confirmModal?.claimId) return;
    const { claimId, action } = confirmModal;
    setActingId(`${claimId}-${action}`);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      setConfirmModal(null);
      await load();
    } catch (err) {
      setMessage(err.message);
      setConfirmModal(null);
    } finally {
      setActingId("");
    }
  }

  async function openStockModal(row) {
    setStockError("");
    setStockLoading(true);
    setStockModal({
      producerId: row.producerId,
      producerName: row.profile?.full_name || "Üretici",
      products: [],
      logs: [],
      netTotal: 0,
    });
    try {
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/stock-breakdown?producerId=${row.producerId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stok detayı alınamadı");
      setStockModal({
        producerId: row.producerId,
        producerName: data.producer?.full_name || row.profile?.full_name || "Üretici",
        products: data.products || [],
        logs: data.logs || [],
        netTotal: Number(data.netTotal || 0),
      });
    } catch (err) {
      setStockError(err.message);
    } finally {
      setStockLoading(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-500">Yükleniyor...</p>;
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <BackButton href="/admin/kampanyalar" label="Kampanyalara dön" />
        <p className="text-rose-600">{message || "Kampanya bulunamadı"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BackButton href="/admin/kampanyalar" label="Kampanyalara dön" />

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">
          {campaign.title || "İsimsiz kampanya"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {formatDate(campaign.starts_at)} — {formatDate(campaign.ends_at)}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Hedef stok</p>
            <p className="text-xl font-semibold">{campaign.target_stock} adet</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Ödül</p>
            <p className="text-xl font-semibold text-emerald-700">
              {formatPrice(campaign.reward_amount)}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Hak eden</p>
            <p className="text-xl font-semibold">{producers.length}</p>
          </div>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {message}
        </p>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Hak eden üreticiler</h2>
        {producers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
            Henüz hedefe ulaşan üretici yok
          </p>
        ) : (
          producers.map((row) => {
            const status = claimLabel(row.claim?.status);
            const claimId = row.claim?.id;
            return (
              <div
                key={row.producerId}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {row.profile?.full_name || "Üretici"}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.text}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500">
                      @{row.profile?.username || "-"}
                      {row.profile?.phone ? ` · ${row.profile.phone}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      Net stok ekleme:{" "}
                      <strong>{row.netStockAdded} adet</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openStockModal(row)}
                      aria-label="Stok detayını gör"
                      title="Stok detayı"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <Link
                      href={`/admin/ureticiler/${row.producerId}`}
                      className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium"
                    >
                      Profil
                    </Link>
                    {claimId && row.claim?.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(actingId)}
                          onClick={() => openConfirm(row, "approve")}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                        >
                          Onayla
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(actingId)}
                          onClick={() => openConfirm(row, "reject")}
                          className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 disabled:opacity-60"
                        >
                          Reddet
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {confirmModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-confirm-title"
          >
            <h3
              id="campaign-confirm-title"
              className="text-lg font-semibold text-zinc-900"
            >
              {confirmModal.action === "approve"
                ? "Kampanyayı onayla"
                : "Kampanyayı reddet"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Emin misiniz?{" "}
              <span className="font-medium text-zinc-900">
                {confirmModal.producerName}
              </span>{" "}
              için{" "}
              {confirmModal.action === "approve" ? (
                <>
                  <span className="font-medium text-zinc-900">
                    {formatPrice(campaign.reward_amount)}
                  </span>{" "}
                  kampanya ödülü ödemelere yansıtılacak.
                </>
              ) : (
                <>bu hak ediş reddedilecek. Bu işlem geri alınamaz.</>
              )}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Net stok: {confirmModal.netStockAdded} adet
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={Boolean(actingId)}
                onClick={() => setConfirmModal(null)}
                className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={Boolean(actingId)}
                onClick={confirmAct}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60 ${
                  confirmModal.action === "approve"
                    ? "bg-emerald-600"
                    : "bg-rose-600"
                }`}
              >
                {actingId
                  ? "İşleniyor..."
                  : confirmModal.action === "approve"
                    ? "Evet, onayla"
                    : "Evet, reddet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stockModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-breakdown-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <div className="min-w-0">
                <h3
                  id="stock-breakdown-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Stok detayı
                </h3>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {stockModal.producerName} · kampanya döneminde manuel stok
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStockModal(null)}
                className="rounded-full px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {stockLoading ? (
                <p className="text-sm text-zinc-500">Yükleniyor...</p>
              ) : stockError ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {stockError}
                </p>
              ) : (
                <>
                  <div className="mb-4 rounded-xl bg-zinc-50 px-4 py-3">
                    <p className="text-xs text-zinc-500">Net stok ekleme</p>
                    <p className="text-2xl font-semibold text-zinc-900">
                      {stockModal.netTotal} adet
                    </p>
                  </div>

                  {stockModal.products.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-8 text-center text-sm text-zinc-500">
                      Bu dönemde manuel stok hareketi yok
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-zinc-800">
                        Ürün bazında
                      </p>
                      {stockModal.products.map((item) => (
                        <div
                          key={item.productId || item.title}
                          className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                            {item.imageUrl ? (
                              <StorageImage
                                src={item.imageUrl}
                                alt={item.title}
                                fill
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {item.title}
                            </p>
                            <p className="text-xs text-zinc-500">
                              +{item.added}
                              {item.removed > 0 ? ` / −${item.removed}` : ""} ·{" "}
                              {item.changeCount} işlem
                            </p>
                          </div>
                          <p
                            className={`shrink-0 text-sm font-semibold ${
                              item.netDelta >= 0
                                ? "text-emerald-700"
                                : "text-rose-600"
                            }`}
                          >
                            {item.netDelta > 0 ? "+" : ""}
                            {item.netDelta}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {stockModal.logs.length > 0 ? (
                    <div className="mt-5 space-y-2 border-t border-zinc-100 pt-4">
                      <p className="text-sm font-semibold text-zinc-800">
                        Hareket geçmişi
                      </p>
                      {stockModal.logs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-xl bg-zinc-50 px-3 py-2 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate font-medium">
                              {log.title}
                            </p>
                            <p
                              className={`shrink-0 font-semibold ${
                                log.delta >= 0
                                  ? "text-emerald-700"
                                  : "text-rose-600"
                              }`}
                            >
                              {log.delta > 0 ? "+" : ""}
                              {log.delta}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {log.previousQuantity} → {log.newQuantity} ·{" "}
                            {formatDate(log.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
