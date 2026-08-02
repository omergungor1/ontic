"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PhoneInput from "@/components/PhoneInput";
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

export default function AdminProducersPage() {
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const filtered = producers.filter((p) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      p.full_name?.toLowerCase().includes(term) ||
      p.username?.toLowerCase().includes(term) ||
      p.city?.toLowerCase().includes(term)
    );
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İsim, kullanıcı adı veya şehir ara"
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Üretici bulunamadı
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/admin/ureticiler/${p.id}`}
              className="rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-orange-300"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{p.full_name}</p>
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
              <p className="mt-1 text-sm text-zinc-500">@{p.username}</p>
              <p className="mt-2 text-sm text-zinc-600">
                {[p.city, p.district].filter(Boolean).join(" / ") || "-"}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Kayıt: {formatDate(p.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}

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
