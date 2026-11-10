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
  { key: "14", label: "14 gün", days: 14 },
  { key: "30", label: "30 gün", days: 30 },
  { key: "90", label: "90 gün", days: 90 },
  { key: "all", label: "Tümü", days: null },
];

const REPORTS = [
  {
    key: "assign",
    label: "Kime vereyim?",
    hint: "Siparişi kime ürettireceğinize karar vermek için önerilen sıra",
  },
  {
    key: "shipping",
    label: "Kargo",
    hint: "En hızlı ve en yavaş kargolayan üreticiler",
  },
  {
    key: "stock",
    label: "Stok",
    hint: "Stok doluluğu yüksek ve düşük üreticiler",
  },
  {
    key: "earnings",
    label: "Gelir",
    hint: "Seçili dönemde en çok ve en az kazandırdığınız üreticiler",
  },
  {
    key: "workload",
    label: "İş yükü",
    hint: "Elinde açık iş olanlar ve şu an boş olanlar",
  },
  {
    key: "overview",
    label: "Genel",
    hint: "Dönem özeti ve genel performans sıralaması",
  },
];

function pct(value) {
  if (value == null) return "—";
  return `%${Number(value).toLocaleString("tr-TR", {
    maximumFractionDigits: 1,
  })}`;
}

function assignScore(row) {
  if (!row.isActive) return -1000;
  const completion = row.completionRate ?? 40;
  const fill = row.stockFillRate ?? 0;
  const speed =
    row.avgShipHours == null
      ? 35
      : Math.max(0, 50 - Math.min(50, row.avgShipHours / 2));
  const capacity = Math.max(0, 25 - row.activeOrders * 8);
  const history = Math.min(15, row.completedOrders * 1.2);
  const failPenalty = Math.min(20, (row.rejectionRate ?? 0) * 0.35);
  return (
    completion * 0.25 +
    fill * 0.25 +
    speed +
    capacity +
    history -
    failPenalty
  );
}

function rankLabel(index) {
  return `${index + 1}.`;
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function Badge({ children, tone = "zinc" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    orange: "bg-orange-50 text-orange-800",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ProducerRow({ row, index, primary, secondary, badges = [] }) {
  return (
    <li className="flex items-start gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 sm:px-5">
      <span className="mt-0.5 w-7 shrink-0 text-sm font-semibold text-zinc-400">
        {rankLabel(index)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/ureticiler/${row.id}`}
            className="truncate font-medium text-zinc-900 hover:text-orange-700"
          >
            {row.fullName}
          </Link>
          {!row.isActive ? <Badge>Pasif</Badge> : null}
          {badges.map((badge) => (
            <Badge key={badge.label} tone={badge.tone}>
              {badge.label}
            </Badge>
          ))}
        </div>
        <p className="mt-0.5 truncate text-xs text-zinc-500">
          {[row.username ? `@${row.username}` : null, row.city]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        {secondary ? (
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {secondary}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-zinc-900">{primary}</p>
      </div>
    </li>
  );
}

function RankList({ title, rows, empty, renderPrimary, renderSecondary, badgesFor }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
        <h3 className="font-semibold text-zinc-900">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500 sm:px-5">
          {empty}
        </p>
      ) : (
        <ul>
          {rows.map((row, index) => (
            <ProducerRow
              key={row.id}
              row={row}
              index={index}
              primary={renderPrimary(row)}
              secondary={renderSecondary?.(row)}
              badges={badgesFor?.(row) || []}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminAnalyticsPage() {
  const [rangeKey, setRangeKey] = useState("30");
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [customOpen, setCustomOpen] = useState(false);
  const [reportKey, setReportKey] = useState("assign");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
    setCustomOpen(false);
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

  const report = REPORTS.find((item) => item.key === reportKey) || REPORTS[0];
  const summary = data?.summary;

  const baseList = useMemo(() => {
    const list = data?.producers || [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (p) =>
        p.fullName?.toLowerCase().includes(term) ||
        p.username?.toLowerCase().includes(term) ||
        p.city?.toLowerCase().includes(term)
    );
  }, [data, search]);

  const reportView = useMemo(() => {
    const active = baseList.filter((p) => p.isActive);
    const withShip = [...baseList].filter((p) => p.avgShipHours != null);
    const withStock = [...baseList].filter((p) => p.assignedProducts > 0);
    const withEarn = [...baseList].filter((p) => p.totalEarning > 0);

    switch (reportKey) {
      case "shipping":
        return {
          cards: [
            {
              label: "Ort. kargo",
              value: formatDurationHours(summary?.avgShipHours),
              hint: `Medyan ${formatDurationHours(summary?.medianShipHours)}`,
            },
            {
              label: "Ölçülen üretici",
              value: withShip.length,
              hint: "En az 1 tamamlanan siparişi olan",
            },
            {
              label: "Tamamlanan",
              value: summary?.completedOrders ?? 0,
              hint: "Seçili dönem",
            },
          ],
          lists: [
            {
              title: "En hızlı kargolayanlar",
              rows: [...withShip]
                .sort((a, b) => a.avgShipHours - b.avgShipHours)
                .slice(0, 20),
              empty: "Henüz kargo süresi ölçülemedi",
              primary: (row) => formatDurationHours(row.avgShipHours),
              secondary: (row) =>
                `${row.completedOrders} tamamlanan · medyan ${formatDurationHours(row.medianShipHours)}`,
            },
            {
              title: "En yavaş kargolayanlar",
              rows: [...withShip]
                .sort((a, b) => b.avgShipHours - a.avgShipHours)
                .slice(0, 20),
              empty: "Henüz kargo süresi ölçülemedi",
              primary: (row) => formatDurationHours(row.avgShipHours),
              secondary: (row) =>
                `${row.completedOrders} tamamlanan · açık iş ${row.activeOrders}`,
              badgesFor: (row) =>
                row.avgShipHours >= 72
                  ? [{ label: "Yavaş", tone: "rose" }]
                  : [],
            },
          ],
        };

      case "stock":
        return {
          cards: [
            {
              label: "Stok doluluk",
              value: pct(summary?.stockFillRate),
              hint: `${summary?.stockedProducts || 0}/${summary?.assignedProducts || 0} ürün`,
            },
            {
              label: "Boş stok",
              value: summary?.zeroStockProducts ?? 0,
              hint: "Aktif atamada stok = 0",
            },
            {
              label: "Toplam stok",
              value: summary?.totalStock ?? 0,
              hint: "Tüm aktif ürünler",
            },
          ],
          lists: [
            {
              title: "Stok doluluğu yüksek",
              rows: [...withStock]
                .sort(
                  (a, b) =>
                    (b.stockFillRate ?? -1) - (a.stockFillRate ?? -1) ||
                    b.totalStock - a.totalStock
                )
                .slice(0, 20),
              empty: "Aktif ürün ataması yok",
              primary: (row) => pct(row.stockFillRate),
              secondary: (row) =>
                `${row.stockedProducts}/${row.assignedProducts} ürün · ${row.totalStock} adet`,
              badgesFor: (row) =>
                (row.stockFillRate ?? 0) >= 80
                  ? [{ label: "Hazır", tone: "green" }]
                  : [],
            },
            {
              title: "Stok doluluğu düşük",
              rows: [...withStock]
                .sort(
                  (a, b) =>
                    (a.stockFillRate ?? 101) - (b.stockFillRate ?? 101) ||
                    b.zeroStockProducts - a.zeroStockProducts
                )
                .slice(0, 20),
              empty: "Aktif ürün ataması yok",
              primary: (row) => pct(row.stockFillRate),
              secondary: (row) =>
                `${row.zeroStockProducts} boş ürün · ${row.totalStock} adet stok`,
              badgesFor: (row) =>
                (row.stockFillRate ?? 0) < 30
                  ? [{ label: "Kritik", tone: "rose" }]
                  : [{ label: "Düşük", tone: "amber" }],
            },
          ],
        };

      case "earnings":
        return {
          cards: [
            {
              label: "Toplam üretici geliri",
              value: formatPrice(summary?.totalEarning || 0),
              hint: "Seçili dönem",
            },
            {
              label: "Kazançlı üretici",
              value: withEarn.length,
              hint: "Bu dönemde gelir alan",
            },
            {
              label: "Sipariş",
              value: summary?.totalOrders ?? 0,
              hint: `${summary?.completedOrders || 0} tamamlandı`,
            },
          ],
          lists: [
            {
              title: "En çok kazandırdıklarınız",
              rows: [...baseList]
                .sort((a, b) => b.totalEarning - a.totalEarning)
                .filter((row) => row.totalEarning > 0)
                .slice(0, 25),
              empty: "Bu dönemde üretici kazancı yok",
              primary: (row) => formatPrice(row.totalEarning),
              secondary: (row) =>
                `${row.completedOrders} tamamlanan · ${row.shippedUnits} adet sevk`,
              badgesFor: () => [{ label: "Gelir", tone: "green" }],
            },
            {
              title: "En az kazandırdıklarınız",
              rows: [...baseList]
                .filter((row) => row.totalOrders > 0)
                .sort((a, b) => a.totalEarning - b.totalEarning)
                .slice(0, 25),
              empty: "Bu dönemde sipariş yok",
              primary: (row) => formatPrice(row.totalEarning),
              secondary: (row) =>
                `${row.totalOrders} sipariş · ${row.completedOrders} tamamlanan`,
            },
          ],
        };

      case "workload": {
        const busy = [...active]
          .filter((p) => p.activeOrders > 0)
          .sort((a, b) => b.activeOrders - a.activeOrders);
        const free = [...active]
          .filter((p) => p.activeOrders === 0)
          .sort(
            (a, b) =>
              (b.stockFillRate ?? -1) - (a.stockFillRate ?? -1) ||
              b.completedOrders - a.completedOrders
          );
        return {
          cards: [
            {
              label: "Açık sipariş",
              value: summary?.activeOrders ?? 0,
              hint: "Üreticilerde bekleyen iş",
            },
            {
              label: "İşi olan",
              value: busy.length,
              hint: "Aktif üretici",
            },
            {
              label: "Boş üretici",
              value: free.length,
              hint: "Açık siparişi yok",
            },
          ],
          lists: [
            {
              title: "Elinde iş olanlar",
              rows: busy.slice(0, 25),
              empty: "Açık işi olan üretici yok",
              primary: (row) => `${row.activeOrders} açık`,
              secondary: (row) =>
                `Tamamlama ${pct(row.completionRate)} · kargo ${formatDurationHours(row.avgShipHours)}`,
              badgesFor: (row) =>
                row.activeOrders >= 3
                  ? [{ label: "Yoğun", tone: "amber" }]
                  : [{ label: "İş var", tone: "orange" }],
            },
            {
              title: "Şu an boş olanlar",
              rows: free.slice(0, 25),
              empty: "Boş üretici yok",
              primary: (row) => pct(row.stockFillRate),
              secondary: (row) =>
                `Stok ${row.totalStock} adet · geçmiş ${row.completedOrders} tamamlanan`,
              badgesFor: () => [{ label: "Müsait", tone: "green" }],
            },
          ],
        };
      }

      case "overview":
        return {
          cards: [
            {
              label: "Aktif üretici",
              value: summary?.activeProducerCount ?? 0,
              hint: `Toplam ${summary?.producerCount || 0}`,
            },
            {
              label: "Tamamlanma",
              value: pct(summary?.completionRate),
              hint: `${summary?.completedOrders || 0} tamam · ${summary?.failedOrders || 0} red/iptal`,
            },
            {
              label: "Üretici geliri",
              value: formatPrice(summary?.totalEarning || 0),
              hint: "Seçili dönem",
            },
            {
              label: "Stok doluluk",
              value: pct(summary?.stockFillRate),
              hint: formatDurationHours(summary?.avgShipHours),
            },
          ],
          lists: [
            {
              title: "Genel performans sırası",
              rows: [...baseList]
                .sort((a, b) => b.score - a.score)
                .slice(0, 40),
              empty: "Üretici bulunamadı",
              primary: (row) => `Skor ${row.score}`,
              secondary: (row) =>
                `${row.completedOrders} tamam · stok ${pct(row.stockFillRate)} · kargo ${formatDurationHours(row.avgShipHours)} · ${formatPrice(row.totalEarning)}`,
            },
          ],
        };

      case "assign":
      default: {
        const ranked = [...active]
          .map((row) => ({ ...row, assignScore: assignScore(row) }))
          .sort((a, b) => b.assignScore - a.assignScore);
        const top = ranked.slice(0, 25);
        const avoid = [...ranked]
          .filter(
            (row) =>
              row.activeOrders >= 3 ||
              (row.stockFillRate === 0 && row.assignedProducts > 0) ||
              (row.avgShipHours != null && row.avgShipHours >= 96) ||
              (row.rejectionRate != null && row.rejectionRate >= 25)
          )
          .sort((a, b) => {
            const risk = (row) =>
              (row.activeOrders >= 3 ? 40 : 0) +
              (row.stockFillRate === 0 ? 30 : 0) +
              (row.avgShipHours != null && row.avgShipHours >= 96 ? 25 : 0) +
              (row.rejectionRate != null && row.rejectionRate >= 25 ? 20 : 0);
            return risk(b) - risk(a);
          })
          .slice(0, 15);
        return {
          cards: [
            {
              label: "Önerilen üretici",
              value: top.filter((row) => row.assignScore > 40).length,
              hint: "Müsait + stok + hız dengesi",
            },
            {
              label: "Boş kapasite",
              value: active.filter((p) => p.activeOrders === 0).length,
              hint: "Açık işi olmayan aktif üretici",
            },
            {
              label: "Dikkat",
              value: avoid.length,
              hint: "Yoğun, yavaş veya stoksuz",
            },
          ],
          lists: [
            {
              title: "Önce bunlara verin",
              rows: top,
              empty: "Aktif üretici yok",
              primary: (row) =>
                row.activeOrders === 0 ? "Müsait" : `${row.activeOrders} açık`,
              secondary: (row) =>
                `Stok ${pct(row.stockFillRate)} · kargo ${formatDurationHours(row.avgShipHours)} · tamam ${pct(row.completionRate)} · ${formatPrice(row.totalEarning)}`,
              badgesFor: (row) => {
                const badges = [];
                if (row.activeOrders === 0) {
                  badges.push({ label: "Boş", tone: "green" });
                }
                if ((row.stockFillRate ?? 0) >= 70) {
                  badges.push({ label: "Stoklu", tone: "orange" });
                }
                if (row.avgShipHours != null && row.avgShipHours <= 36) {
                  badges.push({ label: "Hızlı", tone: "green" });
                }
                return badges;
              },
            },
            {
              title: "Şimdilik sakının",
              rows: avoid,
              empty: "Kritik uyarı yok",
              primary: (row) =>
                row.activeOrders > 0
                  ? `${row.activeOrders} açık`
                  : pct(row.stockFillRate),
              secondary: (row) =>
                `Kargo ${formatDurationHours(row.avgShipHours)} · red ${pct(row.rejectionRate)} · stok ${pct(row.stockFillRate)}`,
              badgesFor: (row) => {
                const badges = [];
                if (row.activeOrders >= 3) {
                  badges.push({ label: "Yoğun", tone: "amber" });
                }
                if ((row.stockFillRate ?? 100) < 20) {
                  badges.push({ label: "Stoksuz", tone: "rose" });
                }
                if ((row.avgShipHours ?? 0) >= 96) {
                  badges.push({ label: "Yavaş", tone: "rose" });
                }
                return badges;
              },
            },
          ],
        };
      }
    }
  }, [baseList, reportKey, summary]);

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Analiz & İstatistik</h1>
          <p className="text-zinc-500">
            Siparişi kime vereceğinizi seçmek için üretici raporları
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
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Dönem
        </p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => applyRange(range.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                rangeKey === range.key
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {range.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomOpen((open) => !open)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              rangeKey === "custom" || customOpen
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            Özel
          </button>
        </div>

        {customOpen ? (
          <form
            onSubmit={applyCustomRange}
            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
          >
            <label className="block text-sm text-zinc-600">
              Başlangıç
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-zinc-600">
              Bitiş
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white sm:self-end"
            >
              Uygula
            </button>
          </form>
        ) : null}

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Rapor
        </p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {REPORTS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setReportKey(item.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                reportKey === item.key
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-zinc-600">{report.hint}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Üretici ara"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 sm:max-w-xs"
        />
        <p className="text-sm text-zinc-500">
          {loading ? "Yükleniyor..." : `${baseList.length} üretici`}
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
          <div
            className={`grid gap-3 ${
              reportView.cards.length > 3
                ? "sm:grid-cols-2 xl:grid-cols-4"
                : "sm:grid-cols-3"
            }`}
          >
            {reportView.cards.map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                hint={card.hint}
              />
            ))}
          </div>

          <div
            className={`grid gap-4 ${
              reportView.lists.length > 1 ? "lg:grid-cols-2" : ""
            }`}
          >
            {reportView.lists.map((list) => (
              <RankList
                key={list.title}
                title={list.title}
                rows={list.rows}
                empty={list.empty}
                renderPrimary={list.primary}
                renderSecondary={list.secondary}
                badgesFor={list.badgesFor}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
