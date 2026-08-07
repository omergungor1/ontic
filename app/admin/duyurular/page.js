"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, truncate } from "@/lib/format";

const emptyForm = {
  id: null,
  title: "",
  description: "",
  image_url: "",
  is_active: true,
};

export default function AdminAnnouncementsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);

  function showToast(text, type = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3000);
  }

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("announcements")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (loadError) showToast(loadError.message, "error");
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setOpen(true);
  }

  function openEdit(row) {
    setForm({
      id: row.id,
      title: row.title || "",
      description: row.description || "",
      image_url: row.image_url || "",
      is_active: Boolean(row.is_active),
    });
    setFormError("");
    setOpen(true);
  }

  async function uploadImage(file) {
    if (!file) return;
    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "announcement-images");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız");
      setForm((prev) => ({ ...prev, image_url: data.url }));
      showToast("Görsel yüklendi");
    } catch (err) {
      setFormError(err.message);
      showToast(err.message, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(e) {
    e.preventDefault();
    const title = form.title.trim();
    const description = form.description.trim();
    if (!title) {
      setFormError("Başlık zorunludur");
      return;
    }
    setSaving(true);
    setFormError("");
    const supabase = createClient();
    const payload = {
      title,
      description,
      image_url: form.image_url || null,
      is_active: Boolean(form.is_active),
      updated_at: new Date().toISOString(),
    };

    let saveError = null;
    if (form.id) {
      const { error: updateError } = await supabase
        .from("announcements")
        .update(payload)
        .eq("id", form.id);
      saveError = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("announcements")
        .insert(payload);
      saveError = insertError;
    }

    setSaving(false);
    if (saveError) {
      setFormError(saveError.message);
      showToast(saveError.message, "error");
      return;
    }
    setOpen(false);
    showToast(form.id ? "Duyuru güncellendi" : "Duyuru eklendi");
    await load();
  }

  async function toggleActive(row) {
    const nextActive = !row.is_active;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("announcements")
      .update({
        is_active: nextActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updateError) {
      showToast(updateError.message, "error");
      return;
    }
    showToast(nextActive ? "Duyuru aktif edildi" : "Duyuru pasife alındı");
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("announcements")
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (deleteError) {
      showToast(deleteError.message, "error");
      return;
    }
    setDeleteTarget(null);
    showToast("Duyuru silindi");
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Duyurular</h1>
          <p className="text-zinc-500">
            Aktif duyurular üretici ana sayfasında slider olarak görünür
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
        >
          + Duyuru ekle
        </button>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Henüz duyuru yok
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <div className="relative aspect-[16/9] bg-zinc-100">
                {row.image_url ? (
                  <Image
                    src={row.image_url}
                    alt={row.title}
                    fill
                    className="object-cover"
                    sizes="(max-width:768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                    Görsel yok
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 font-semibold leading-snug">
                    {row.title}
                  </h2>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2">
                    <span
                      className={`text-xs font-medium ${
                        row.is_active ? "text-emerald-700" : "text-zinc-500"
                      }`}
                    >
                      {row.is_active ? "Aktif" : "Pasif"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.is_active}
                      aria-label={
                        row.is_active
                          ? "Duyuruyu pasife al"
                          : "Duyuruyu aktife al"
                      }
                      onClick={() => toggleActive(row)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${
                        row.is_active ? "bg-emerald-500" : "bg-zinc-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                          row.is_active ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </label>
                </div>
                <p className="text-sm text-zinc-600">
                  {truncate(row.description, 120) || "Açıklama yok"}
                </p>
                <p className="text-xs text-zinc-400">
                  {formatDate(row.created_at)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="flex-1 rounded-xl border border-zinc-300 py-2 text-sm font-medium"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(row)}
                    className="flex-1 rounded-xl border border-rose-200 py-2 text-sm font-medium text-rose-600"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <form
            onSubmit={save}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {form.id ? "Duyuruyu düzenle" : "Yeni duyuru"}
                </h3>
                <p className="text-sm text-zinc-500">
                  Başlık, açıklama ve görsel
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-xl leading-none text-zinc-400 hover:bg-zinc-100"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Başlık</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Açıklama
                </span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </label>

              <div>
                <span className="mb-1.5 block text-sm font-medium">Görsel</span>
                {form.image_url ? (
                  <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-xl bg-zinc-100">
                    <Image
                      src={form.image_url}
                      alt="Duyuru görseli"
                      fill
                      className="object-cover"
                      sizes="400px"
                    />
                  </div>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-medium disabled:opacity-60"
                >
                  {uploading
                    ? "Yükleniyor..."
                    : form.image_url
                      ? "Görseli değiştir"
                      : "Görsel yükle"}
                </button>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-3">
                <span className="text-sm font-medium">Aktif</span>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-orange-600"
                />
              </label>

              {formError ? (
                <p className="text-sm text-rose-600">{formError}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 gap-2 border-t border-zinc-100 px-4 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-announcement-title"
          >
            <h3
              id="delete-announcement-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Duyuruyu sil
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-900">
                “{deleteTarget.title}”
              </span>{" "}
              duyurusunu silmek istiyor musunuz? Bu işlem geri alınamaz.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {deleting ? "Siliniyor..." : "Evet, sil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-6 left-1/2 z-[60] w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm font-medium shadow-lg ${
            toast.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-zinc-900 text-white"
          }`}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
