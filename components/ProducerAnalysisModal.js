"use client";

import { useEffect, useState } from "react";

function line(label, value) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-900">{value}</span>
    </div>
  );
}

export default function ProducerAnalysisModal({ producer, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!producer?.id) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/producers/${producer.id}/analysis`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Analiz yüklenemedi");
        if (!cancelled) setAnalysis(data.analysis);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [producer?.id]);

  if (!producer) return null;

  const money = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="producer-analysis-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="producer-analysis-title" className="text-lg font-semibold">
              Analiz
            </h3>
            <p className="text-sm text-zinc-500">{producer.full_name || analysis?.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            Kapat
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {!analysis && !error ? <p className="mt-4 text-sm text-zinc-500">Yükleniyor...</p> : null}

        {analysis ? (
          <div className="mt-4">
            {line("Skor", analysis.score)}
            {line("30 gün kişi başı kazanç", money.format(analysis.perCapita || 0))}
            {line("30 gün toplam kazanç", money.format(analysis.earnings30 || 0))}
            {line("Kişi çarpanı", analysis.multiplier)}
            {line(
              "Açık sipariş",
              analysis.maxOpen == null
                ? `${analysis.openCount} / limitsiz`
                : `${analysis.openCount} / ${analysis.maxOpen}`
            )}
            {line(
              "Kargo süresi",
              analysis.medianHours == null ? "—" : `${analysis.medianHours} saat`
            )}
            {line("Son 30 gün red", analysis.rejects30)}
            {line("Hesap yaşı", `${analysis.ageDays} gün`)}
            {line("Açık ürün", analysis.stock.products)}
            {line("Toplam stok", `${analysis.stock.units} adet`)}
            {line("Stoğu 2 ve altı ürün", analysis.stock.low)}
            {analysis.inactive ? (
              <p className="mt-3 text-sm text-zinc-500">Hesap pasif.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
