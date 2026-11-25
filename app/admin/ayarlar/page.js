"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/format";

const HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);

function clockParts(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  return {
    hour: match ? match[1] : "09",
    minute: match ? match[2] : "00",
  };
}

const ACTION_TONE = {
  assigned: "bg-emerald-50 text-emerald-800",
  held: "bg-amber-50 text-amber-800",
  expired: "bg-rose-50 text-rose-700",
  kept: "bg-orange-50 text-orange-800",
};

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function AutoAssignLogModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const scrollerRef = useRef(null);
  const sentinelRef = useRef(null);
  const logsRef = useRef([]);
  const busyRef = useRef(false);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function loadFirst() {
      busyRef.current = true;
      try {
        const res = await fetch("/api/admin/auto-assign-logs?offset=0&limit=25");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Kayıtlar yüklenemedi");
        if (cancelled) return;
        setLogs(data.logs || []);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        busyRef.current = false;
        if (!cancelled) setLoading(false);
      }
    }
    loadFirst();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = scrollerRef.current;
    const target = sentinelRef.current;
    if (loading || !hasMore || !root || !target) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || busyRef.current) {
          return;
        }
        const offset = logsRef.current.length;
        busyRef.current = true;
        fetch(`/api/admin/auto-assign-logs?offset=${offset}&limit=25`)
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Kayıtlar yüklenemedi");
            const incoming = data.logs || [];
            setLogs((prev) => {
              const seen = new Set(prev.map((row) => row.id));
              return [
                ...prev,
                ...incoming.filter((row) => !seen.has(row.id)),
              ];
            });
            setHasMore(Boolean(data.hasMore));
          })
          .catch((err) => setError(err.message))
          .finally(() => {
            busyRef.current = false;
          });
      },
      { root, rootMargin: "160px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, hasMore, logs.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-assign-log-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:max-h-[85vh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 id="auto-assign-log-title" className="text-lg font-semibold">
              Oto dağıtım geçmişi
            </h2>
            <p className="text-sm text-zinc-500">
              Atama, bekleme ve iptal kayıtları
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            Kapat
          </button>
        </div>

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"
        >
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {loading ? <p className="text-sm text-zinc-500">Yükleniyor...</p> : null}
          {!loading && !logs.length ? (
            <p className="text-sm text-zinc-500">Henüz kayıt yok.</p>
          ) : null}

          {logs.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ACTION_TONE[row.action] || "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {row.actionLabel}
                </span>
                <time className="text-xs text-zinc-500">
                  {formatDate(row.createdAt)}
                </time>
              </div>
              <p className="mt-2 text-sm text-zinc-800">{row.detail}</p>
              {row.orderNumber || row.producerName ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {row.orderId && row.orderNumber ? (
                    <Link
                      href={`/admin/siparisler/${row.orderId}`}
                      className="font-medium text-orange-700"
                    >
                      {row.orderNumber}
                    </Link>
                  ) : null}
                  {row.orderNumber && row.producerName ? " · " : null}
                  {row.producerName}
                </p>
              ) : null}
            </article>
          ))}

          {hasMore && !loading ? (
            <div ref={sentinelRef} className="py-2 text-center text-xs text-zinc-400">
              Daha eski kayıtlar yükleniyor...
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CargoCompanyManager() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/cargo-companies");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Kargo firmaları yüklenemedi");
    setCompanies(data.companies || []);
  }

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function addCompany(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cargo-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompany(company) {
    setError("");
    const res = await fetch("/api/admin/cargo-companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: company.id, isActive: !company.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Güncellenemedi");
      return;
    }
    setCompanies((prev) =>
      prev.map((item) => (item.id === company.id ? data.company : item))
    );
  }

  return (
    <section className="max-w-xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="font-semibold">Kargo firmaları</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Üreticiler aktif firmalardan birini tercih eder. Pasif firma yeni
          seçimlerde görünmez.
        </p>
      </div>
      {loading ? <p className="text-sm text-zinc-500">Yükleniyor...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <ul className="space-y-2">
        {companies.map((company) => (
          <li
            key={company.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2"
          >
            <span className={company.isActive ? "text-sm" : "text-sm text-zinc-400"}>
              {company.name}
            </span>
            <button
              type="button"
              onClick={() => toggleCompany(company)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                company.isActive
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {company.isActive ? "Aktif" : "Pasif"}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={addCompany} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Yeni firma adı"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          Ekle
        </button>
      </form>
    </section>
  );
}

function ClockField({ label, value, onChange }) {
  const { hour, minute } = clockParts(value);
  const selectClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 tabular-nums";

  function update(nextHour, nextMinute) {
    onChange(`${nextHour}:${nextMinute}`);
  }

  return (
    <fieldset className="block text-sm">
      <legend className="mb-1 block text-zinc-500">{label}</legend>
      <div className="flex items-center gap-2">
        <select
          aria-label={`${label} saati`}
          value={hour}
          onChange={(event) => update(event.target.value, minute)}
          className={selectClass}
        >
          {HOURS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <span className="text-zinc-400">:</span>
        <select
          aria-label={`${label} dakikası`}
          value={minute}
          onChange={(event) => update(hour, event.target.value)}
          className={selectClass}
        >
          {MINUTES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    enabled: false,
    start: "09:00",
    end: "22:00",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ayarlar yüklenemedi");
        if (!cancelled) setSettings(data.settings);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");
      setSettings(data.settings);
      setMessage("Ayarlar kaydedildi");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Ayarlar</h1>
        <p className="text-zinc-500">Oto dağıtım, çalışma saatleri ve kargo firmaları</p>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <form
          onSubmit={save}
          className="max-w-xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-zinc-900">Oto dağıtım</p>
              <p className="mt-1 text-sm text-zinc-500">
                Açıkken senkron sonrası uygun siparişler üreticilere dağıtılır.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() =>
                setSettings((prev) => ({ ...prev, enabled: !prev.enabled }))
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                settings.enabled ? "bg-orange-600" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                  settings.enabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ClockField
              label="Başlangıç"
              value={settings.start}
              onChange={(start) => setSettings((prev) => ({ ...prev, start }))}
            />
            <ClockField
              label="Bitiş"
              value={settings.end}
              onChange={(end) => setSettings((prev) => ({ ...prev, end }))}
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <div className="flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              type="button"
              onClick={() => setLogsOpen(true)}
              aria-label="Oto dağıtım geçmişi"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            >
              <HistoryIcon />
            </button>
          </div>
        </form>
      )}

      <CargoCompanyManager />

      {logsOpen ? (
        <AutoAssignLogModal onClose={() => setLogsOpen(false)} />
      ) : null}
    </div>
  );
}
