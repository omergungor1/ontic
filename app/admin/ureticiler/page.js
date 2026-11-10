"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import PhoneInput from "@/components/PhoneInput";
import ProducerPerformancePanel, {
  fetchProducerAnalytics,
} from "@/components/ProducerPerformancePanel";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { isValidTrMobile } from "@/lib/phone";

const emptyForm = {
  username: "",
  fullName: "",
  city: "",
  district: "",
  password: "",
  phone: "",
};

const SORT_OPTIONS = [
  { key: "newest", label: "En yeni kayıt" },
  { key: "perf-desc", label: "En iyi performans" },
  { key: "perf-asc", label: "En düşük performans" },
  { key: "name-asc", label: "Alfabetik (A → Z)" },
  { key: "name-desc", label: "Alfabetik (Z → A)" },
];

function scoreButtonClass(score) {
  if (score == null || Number.isNaN(Number(score))) {
    return "border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100";
  }
  const value = Number(score);
  if (value >= 70) {
    return "border-teal-200/80 bg-teal-50 text-teal-700 hover:bg-teal-100/70";
  }
  if (value >= 50) {
    return "border-sky-200/80 bg-sky-50 text-sky-700 hover:bg-sky-100/70";
  }
  if (value >= 35) {
    return "border-amber-200/80 bg-amber-50 text-amber-700 hover:bg-amber-100/70";
  }
  return "border-rose-200/70 bg-rose-50 text-rose-600 hover:bg-rose-100/70";
}

function StatsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M4 19V10M10 19V5M16 19v-7M22 19H2"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M4 7h11M4 12h7M4 17h4M16 9l3-3 3 3M19 6v12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminProducersPage() {
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [perfById, setPerfById] = useState({});
  const [statsTarget, setStatsTarget] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [statsData, setStatsData] = useState(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "producer")
      .order("created_at", { ascending: false });
    setProducers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!sortMenuOpen) return undefined;
    function onPointerDown(event) {
      if (!sortMenuRef.current?.contains(event.target)) {
        setSortMenuOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setSortMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sortMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadScores() {
      try {
        const data = await fetchProducerAnalytics({ days: 30 });
        if (cancelled) return;
        const map = {};
        for (const row of data.producers || []) {
          map[row.id] = row;
        }
        setPerfById(map);
      } catch {
        if (!cancelled) setPerfById({});
      }
    }
    loadScores();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!statsTarget) return undefined;
    let cancelled = false;
    const cached = perfById[statsTarget.id];
    if (cached) setStatsData(cached);
    else setStatsData(null);

    async function loadStats() {
      setStatsLoading(true);
      setStatsError("");
      try {
        const data = await fetchProducerAnalytics({
          producerId: statsTarget.id,
          days: 30,
        });
        if (cancelled) return;
        setStatsData(data.producers?.[0] || null);
      } catch (err) {
        if (!cancelled) setStatsError(err.message);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }
    loadStats();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsTarget]);

  const filtered = producers
    .filter((p) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        p.full_name?.toLowerCase().includes(term) ||
        p.username?.toLowerCase().includes(term) ||
        p.city?.toLowerCase().includes(term)
      );
    })
    .slice()
    .sort((a, b) => {
      const nameA = (a.full_name || a.username || "").toLocaleLowerCase("tr");
      const nameB = (b.full_name || b.username || "").toLocaleLowerCase("tr");
      const scoreA = perfById[a.id]?.score;
      const scoreB = perfById[b.id]?.score;
      const hasA = scoreA != null && !Number.isNaN(Number(scoreA));
      const hasB = scoreB != null && !Number.isNaN(Number(scoreB));

      if (sortBy === "name-asc") return nameA.localeCompare(nameB, "tr");
      if (sortBy === "name-desc") return nameB.localeCompare(nameA, "tr");
      if (sortBy === "perf-desc") {
        if (hasA && hasB) return Number(scoreB) - Number(scoreA);
        if (hasA) return -1;
        if (hasB) return 1;
        return nameA.localeCompare(nameB, "tr");
      }
      if (sortBy === "perf-asc") {
        if (hasA && hasB) return Number(scoreA) - Number(scoreB);
        if (hasA) return -1;
        if (hasB) return 1;
        return nameA.localeCompare(nameB, "tr");
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const username = form.username.trim().toLowerCase();
      if (!/^[a-z0-9]+$/.test(username)) {
        throw new Error(
          "Kullanıcı adı sadece harf ve rakamlardan oluşmalı, boşluk içeremez"
        );
      }
      if (!isValidTrMobile(form.phone)) {
        throw new Error("Telefon 05XX XXX XX XX formatında olmalıdır");
      }
      const res = await fetch("/api/admin/producers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Üretici eklenemedi");
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Üreticiler</h1>
          <p className="text-zinc-500">Üretici ekle, düzenle, ürün ata</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setForm(emptyForm);
            setOpen(true);
          }}
          className="w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
        >
          + Üretici ekle
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, kullanıcı adı veya şehir ara"
            className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-500"
          />
          <div ref={sortMenuRef} className="relative shrink-0">
            <button
              type="button"
              aria-label="Sıralama"
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
              title="Sıralama"
              onClick={() => setSortMenuOpen((prev) => !prev)}
              className={`inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl border text-zinc-600 transition ${
                sortMenuOpen
                  ? "border-orange-300 bg-orange-50 text-orange-700"
                  : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
              }`}
            >
              <SortIcon />
            </button>
            {sortMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
              >
                {SORT_OPTIONS.map((option) => {
                  const active = sortBy === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setSortBy(option.key);
                        setSortMenuOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? "bg-orange-50 font-medium text-orange-700"
                          : "text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Üretici bulunamadı
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const score = perfById[p.id]?.score;
            return (
              <article
                key={p.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-orange-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/ureticiler/${p.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="font-semibold text-zinc-900">{p.full_name}</p>
                    <p className="mt-1 text-sm text-zinc-500">@{p.username}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStatsTarget(p)}
                      aria-label={`${p.full_name} performansını göster`}
                      title="Performans"
                      className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition ${scoreButtonClass(score)}`}
                    >
                      <StatsIcon />
                      {score != null ? score : "—"}
                    </button>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        p.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {p.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                </div>
                <Link href={`/admin/ureticiler/${p.id}`} className="block">
                  <p className="mt-2 text-sm text-zinc-600">
                    {[p.city, p.district].filter(Boolean).join(" / ") || "-"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Kayıt: {formatDate(p.created_at)}
                  </p>
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {statsTarget ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="producer-stats-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  id="producer-stats-title"
                  className="truncate text-lg font-semibold text-zinc-900"
                >
                  {statsTarget.full_name}
                </h3>
                <p className="text-sm text-zinc-500">
                  Son 30 gün performans özeti
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatsTarget(null)}
                className="rounded-full px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>
            <div className="mt-4">
              {statsError ? (
                <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
                  {statsError}
                </p>
              ) : null}
              <ProducerPerformancePanel
                stats={statsData}
                loading={statsLoading && !statsData}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatsTarget(null)}
                className="rounded-xl border border-zinc-200 py-2.5 text-sm font-medium"
              >
                Kapat
              </button>
              <Link
                href={`/admin/ureticiler/${statsTarget.id}?tab=performans`}
                className="rounded-xl bg-zinc-900 py-2.5 text-center text-sm font-semibold text-white"
              >
                Detaya git
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5"
          >
            <h3 className="text-lg font-semibold">Yeni Üretici</h3>
            <div>
              <input
                required
                placeholder="Kullanıcı adı"
                value={form.username}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    username: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, ""),
                  }))
                }
                pattern="[a-z0-9]+"
                title="Sadece harf ve rakam (boşluk yok)"
                autoComplete="off"
                className="w-full rounded-xl border px-3 py-2"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Sadece harf ve rakam; boşluk ve özel karakter yok
              </p>
            </div>
            <input
              required
              placeholder="Ad Soyad"
              value={form.fullName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, fullName: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Şehir"
                value={form.city}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2"
              />
              <input
                placeholder="İlçe"
                value={form.district}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, district: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2"
              />
            </div>
            <PhoneInput
              required
              value={form.phone}
              onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
              className="w-full rounded-xl border px-3 py-2"
            />
            <input
              required
              type="text"
              placeholder="Şifre"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
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
