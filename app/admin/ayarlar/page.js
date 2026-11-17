"use client";

import { useEffect, useState } from "react";

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
        <p className="text-zinc-500">Oto dağıtım ve çalışma saatleri</p>
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
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Başlangıç</span>
              <input
                type="time"
                value={settings.start}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, start: event.target.value }))
                }
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Bitiş</span>
              <input
                type="time"
                value={settings.end}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, end: event.target.value }))
                }
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
              />
            </label>
          </div>
          <p className="text-xs text-zinc-400">
            Saatler Türkiye saatine göredir. Aralık dışında yeni atama ve 3
            saatlik onay iptali yapılmaz.
          </p>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>
      )}
    </div>
  );
}
