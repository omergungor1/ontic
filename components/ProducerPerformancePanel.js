"use client";

import { formatDurationHours } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";

function pct(value) {
  if (value == null) return "—";
  return `%${Number(value).toLocaleString("tr-TR", {
    maximumFractionDigits: 1,
  })}`;
}

function ScoreBar({ score }) {
  const width = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className="h-full rounded-full bg-orange-500"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3.5">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export default function ProducerPerformancePanel({
  stats,
  loading = false,
  emptyText = "Bu dönem için performans verisi yok",
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">Performans yükleniyor...</p>;
  }

  if (!stats) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Performans puanı</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
              {stats.score}
            </p>
          </div>
          <p className="max-w-[14rem] text-right text-xs leading-relaxed text-zinc-500">
            Tamamlama, stok doluluk, hacim ve kargo süresine göre
          </p>
        </div>
        <div className="mt-3">
          <ScoreBar score={stats.score} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          label="Tamamlanma"
          value={pct(stats.completionRate)}
          hint={`${stats.completedOrders} tamam · ${stats.failedOrders} red/iptal`}
        />
        <Metric
          label="Ort. kargo süresi"
          value={formatDurationHours(stats.avgShipHours)}
          hint={
            stats.medianShipHours != null
              ? `Medyan ${formatDurationHours(stats.medianShipHours)}`
              : "Ölçüm yok"
          }
        />
        <Metric
          label="Stok doluluk"
          value={pct(stats.stockFillRate)}
          hint={`${stats.stockedProducts}/${stats.assignedProducts} ürün · ${stats.totalStock} adet`}
        />
        <Metric
          label="Dönem kazancı"
          value={formatPrice(stats.totalEarning)}
          hint={`${stats.shippedUnits} adet sevk`}
        />
        <Metric
          label="Sipariş"
          value={stats.totalOrders}
          hint={`${stats.activeOrders} açık · ${stats.completedOrders} tamamlanan`}
        />
        <Metric
          label="Red oranı"
          value={pct(stats.rejectionRate)}
          hint={`${stats.failedOrders} iptal/red`}
        />
      </div>
    </div>
  );
}

export function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchProducerAnalytics({
  producerId,
  days = 30,
} = {}) {
  const params = new URLSearchParams();
  if (producerId) params.set("producerId", producerId);
  if (days != null) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    params.set("from", from.toISOString());
    params.set("to", to.toISOString());
  }
  const res = await fetch(`/api/admin/analytics?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Performans yüklenemedi");
  return json;
}
