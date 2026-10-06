"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDurationHours } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const RANGES = [
  { key: "7", label: "7 gün", days: 7 },
  { key: "30", label: "30 gün", days: 30 },
  { key: "90", label: "90 gün", days: 90 },
  { key: "all", label: "Tümü", days: null },
];

function pct(value) {
  if (value == null) return "—";
  return `%${Number(value).toLocaleString("tr-TR", {
    maximumFractionDigits: 1,
  })}`;
}

function ScoreBar({ score }) {
  const width = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className="h-full rounded-full bg-orange-500 transition-all"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function MiniLeader({ title, rows, empty, renderValue }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-zinc-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/ureticiler/${row.id}`}
                  className="truncate font-medium text-zinc-900 hover:text-orange-700"
                >
                  {index + 1}. {row.fullName}
                </Link>
                {row.username ? (
                  <p className="truncate text-xs text-zinc-500">
                    @{row.username}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 font-semibold text-zinc-800">
                {renderValue(row)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [rangeKey, setRangeKey] = useState("30");
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("score");

  async function load({ nextFrom = from, nextTo = to } = {}) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (nextFrom) {
        params.set("from", new Date(nextFrom).toISOString());
      }
      if (nextTo) {
        const end = new Date(nextTo);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }
      const res = await fetch(`/api/admin/analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analiz yüklenemedi");
      setData(json);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyRange(key) {
    setRangeKey(key);
    const range = RANGES.find((r) => r.key === key);
    if (!range || range.days == null) {
      setFrom("");
      setTo(todayIso());
      load({ nextFrom: "", nextTo: todayIso() });
      return;
    }
    const nextFrom = daysAgoIso(range.days);
    const nextTo = todayIso();
    setFrom(nextFrom);
    setTo(nextTo);
    load({ nextFrom, nextTo });
  }

  function applyCustomRange(e) {
    e.preventDefault();
    setRangeKey("custom");
    load({ nextFrom: from, nextTo: to });
  }

  const producers = useMemo(() => {
    const list = data?.producers || [];
    const term = search.trim().toLowerCase();
    let filtered = list;
    if (term) {
      filtered = list.filter(
        (p) =>
          p.fullName?.toLowerCase().includes(term) ||
          p.username?.toLowerCase().includes(term) ||
          p.city?.toLowerCase().includes(term)
      );
    }

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "avgShipHours":
          return (a.avgShipHours ?? 9999) - (b.avgShipHours ?? 9999);
        case "stockFillRate":
          return (b.stockFillRate ?? -1) - (a.stockFillRate ?? -1);
        case "completedOrders":
          return b.completedOrders - a.completedOrders;
        case "totalEarning":
          return b.totalEarning - a.totalEarning;
        case "name":
          return String(a.fullName).localeCompare(String(b.fullName), "tr");
        case "score":
        default:
          return b.score - a.score;
      }
    });
    return sorted;
  }, [data, search, sortKey]);

  const summary = data?.summary;

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Analiz & İstatistik</h1>
          <p className="text-zinc-500">
            Üretici performansı, kargo süreleri ve stok doluluk oranı
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60"
        >
          {loading ? "Yenileniyor..." : "Yenile"}
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => applyRange(range.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                rangeKey === range.key
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={applyCustomRange}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="block text-sm text-zinc-600">
            Başlangıç
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 sm:w-44"
            />
          </label>
          <label className="block text-sm text-zinc-600">
            Bitiş
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 sm:w-44"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Uygula
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          Kargo süresi: atama anından tamamlanma/kargolanma anına kadar geçen
          süre. Stok doluluk: stoğu olan aktif ürün atamalarının oranı.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading && !summary ? (
        <p className="text-sm text-zinc-500">Analiz yükleniyor...</p>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Aktif üretici"
              value={summary.activeProducerCount}
              hint={`Toplam ${summary.producerCount} üretici`}
            />
            <SummaryCard
              label="Tamamlanma oranı"
              value={pct(summary.completionRate)}
              hint={`${summary.completedOrders} tamamlandı · ${summary.failedOrders} iptal/red`}
            />
            <SummaryCard
              label="Ort. kargo süresi"
              value={formatDurationHours(summary.avgShipHours)}
              hint={`Medyan: ${formatDurationHours(summary.medianShipHours)}`}
            />
            <SummaryCard
              label="Stok doluluk"
              value={pct(summary.stockFillRate)}
              hint={`${summary.stockedProducts}/${summary.assignedProducts} üründe stok · toplam ${summary.totalStock} adet`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Dönem siparişi"
              value={summary.totalOrders}
              hint={`${summary.activeOrders} açık sipariş`}
            />
            <SummaryCard
              label="Üretici kazancı"
              value={formatPrice(summary.totalEarning)}
              hint="Seçili dönem toplamı"
            />
            <SummaryCard
              label="Stoğu boş ürün"
              value={summary.zeroStockProducts}
              hint="Aktif atamalarda stok = 0"
            />
            <SummaryCard
              label="Toplam stok"
              value={summary.totalStock}
              hint="Tüm üreticilerdeki aktif stok"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <MiniLeader
              title="En hızlı kargolayanlar"
              rows={data.fastestProducers || []}
              empty="Henüz tamamlanmış sipariş yok"
              renderValue={(row) => formatDurationHours(row.avgShipHours)}
            />
            <MiniLeader
              title="En yavaş kargolayanlar"
              rows={data.slowestProducers || []}
              empty="Henüz tamamlanmış sipariş yok"
              renderValue={(row) => formatDurationHours(row.avgShipHours)}
            />
            <MiniLeader
              title="Düşük stok doluluk"
              rows={data.lowStockProducers || []}
              empty="Aktif ürün ataması yok"
              renderValue={(row) => pct(row.stockFillRate)}
            />
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Üretici performans tablosu</h2>
                <p className="text-sm text-zinc-500">
                  Skor: tamamlanma, stok doluluk, hacim ve kargo süresine göre
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Üretici ara"
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 sm:w-48"
                />
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="score">Skora göre</option>
                  <option value="avgShipHours">Kargo süresine göre</option>
                  <option value="stockFillRate">Stok doluluğa göre</option>
                  <option value="completedOrders">Tamamlanan sipariş</option>
                  <option value="totalEarning">Kazanca göre</option>
                  <option value="name">İsme göre</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Üretici</th>
                    <th className="px-4 py-3 font-medium">Skor</th>
                    <th className="px-4 py-3 font-medium">Sipariş</th>
                    <th className="px-4 py-3 font-medium">Tamamlama</th>
                    <th className="px-4 py-3 font-medium">Ort. kargo</th>
                    <th className="px-4 py-3 font-medium">Stok doluluk</th>
                    <th className="px-4 py-3 font-medium">Kazanç</th>
                  </tr>
                </thead>
                <tbody>
                  {producers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-zinc-500"
                      >
                        Bu dönemde gösterilecek üretici yok
                      </td>
                    </tr>
                  ) : (
                    producers.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-zinc-100 hover:bg-zinc-50/80"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/ureticiler/${row.id}`}
                            className="font-medium text-zinc-900 hover:text-orange-700"
                          >
                            {row.fullName}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            {row.username ? <span>@{row.username}</span> : null}
                            {row.city ? <span>· {row.city}</span> : null}
                            {!row.isActive ? (
                              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                                Pasif
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-28">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-semibold text-zinc-800">
                                {row.score}
                              </span>
                            </div>
                            <ScoreBar score={row.score} />
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-800">
                          <div>{row.totalOrders} toplam</div>
                          <div className="text-xs text-zinc-500">
                            {row.completedOrders} tamam · {row.activeOrders} açık
                            · {row.failedOrders} red/iptal
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-zinc-800">
                          {pct(row.completionRate)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-800">
                          <div>{formatDurationHours(row.avgShipHours)}</div>
                          {row.medianShipHours != null ? (
                            <div className="text-xs text-zinc-500">
                              medyan {formatDurationHours(row.medianShipHours)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-800">
                          <div className="font-medium">
                            {pct(row.stockFillRate)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {row.stockedProducts}/{row.assignedProducts} ürün ·{" "}
                            {row.totalStock} adet
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-zinc-800">
                          {formatPrice(row.totalEarning)}
                          {row.shippedUnits > 0 ? (
                            <div className="text-xs font-normal text-zinc-500">
                              {row.shippedUnits} adet sevk
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
