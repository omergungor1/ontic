"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PhoneInput from "@/components/PhoneInput";
import { createClient } from "@/lib/supabase/client";
import { formatPhoneInput, isValidTrMobile } from "@/lib/phone";

export default function AdminProducerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const producerId = params?.id;

  const [producer, setProducer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [modalPassword, setModalPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    city: "",
    district: "",
    iban: "",
    adminNote: "",
    isActive: true,
  });

  const [products, setProducts] = useState([]);
  const [assignments, setAssignments] = useState({}); // productId -> {isActive, stockQuantity}
  const [productSearch, setProductSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/producers/${producerId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Üretici bulunamadı");
      setProducer(data.producer);
      setForm({
        fullName: data.producer.full_name || "",
        phone: data.producer.phone
          ? formatPhoneInput(data.producer.phone)
          : "",
        city: data.producer.city || "",
        district: data.producer.district || "",
        iban: data.producer.iban || "",
        adminNote: data.producer.admin_note || "",
        isActive: data.producer.is_active,
      });

      const supabase = createClient();
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, title, image_url, brand_name, is_active")
        .order("title", { ascending: true });

      const assignMap = {};
      for (const pp of data.products || []) {
        assignMap[pp.product_id] = {
          isActive: pp.is_active,
          stockQuantity: pp.stock_quantity,
        };
      }

      setProducts(allProducts || []);
      setAssignments(assignMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (producerId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producerId]);

  function updateAssignment(productId, patch) {
    setAssignments((prev) => ({
      ...prev,
      [productId]: {
        isActive: prev[productId]?.isActive || false,
        stockQuantity: prev[productId]?.stockQuantity || 0,
        ...patch,
      },
    }));
  }

  const sortedProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    let list = products;
    if (term) {
      list = list.filter((p) => p.title?.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      const aActive = assignments[a.id]?.isActive ? 1 : 0;
      const bActive = assignments[b.id]?.isActive ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (a.title || "").localeCompare(b.title || "", "tr");
    });
  }, [products, assignments, productSearch]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (!isValidTrMobile(form.phone)) {
        throw new Error("Telefon 05XX XXX XX XX formatında olmalıdır");
      }

      const productAssignments = Object.entries(assignments).map(
        ([productId, val]) => ({
          productId,
          isActive: Boolean(val.isActive),
          stockQuantity: Number(val.stockQuantity || 0),
        })
      );

      const body = {
        ...form,
        productAssignments,
      };

      const res = await fetch(`/api/admin/producers/${producerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");
      setMessage("Değişiklikler kaydedildi");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openPasswordModal() {
    setModalPassword("");
    setError("");
    setPasswordModalOpen(true);
  }

  function closePasswordModal() {
    if (passwordSaving) return;
    setPasswordModalOpen(false);
    setModalPassword("");
  }

  async function updatePassword() {
    const password = modalPassword.trim();
    if (!password) {
      setError("Yeni şifre boş olamaz");
      return;
    }
    if (
      !confirm(
        "Emin misiniz? Üreticinin şifresi değişecektir."
      )
    ) {
      return;
    }

    setPasswordSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/producers/${producerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Şifre güncellenemedi");
      setPasswordModalOpen(false);
      setModalPassword("");
      setMessage("Şifre güncellendi");
      setShowPassword(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function deleteProducer() {
    if (!confirm("Bu üreticiyi tamamen silmek istiyor musunuz?")) return;
    const res = await fetch(`/api/admin/producers/${producerId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Silinemedi");
      return;
    }
    router.push("/admin/ureticiler");
  }

  if (loading) return <p>Yükleniyor...</p>;
  if (!producer)
    return (
      <div>
        <p>{error || "Üretici bulunamadı"}</p>
        <Link href="/admin/ureticiler" className="text-orange-600">
          Üreticilere dön
        </Link>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.push("/admin/ureticiler")}
            className="mb-2 text-sm text-zinc-500 hover:text-zinc-800"
          >
            ← Üreticilere dön
          </button>
          <h1 className="text-2xl font-semibold">{producer.full_name}</h1>
          <p className="text-zinc-500">@{producer.username}</p>
        </div>
        <button
          type="button"
          onClick={deleteProducer}
          className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600"
        >
          Üreticiyi Sil
        </button>
      </div>

      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={saveProfile} className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Profil Bilgileri</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Ad Soyad</span>
              <input
                value={form.fullName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Telefon</span>
              <PhoneInput
                required
                value={form.phone}
                onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Şehir</span>
              <input
                value={form.city}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">İlçe</span>
              <input
                value={form.district}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, district: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">IBAN</span>
              <input
                value={form.iban}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, iban: e.target.value }))
                }
                placeholder="TR.."
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="h-4 w-4"
              />
              <span>Hesap aktif</span>
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-zinc-500">
              Admin notu (sadece admin görür)
            </span>
            <textarea
              value={form.adminNote}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, adminNote: e.target.value }))
              }
              rows={3}
              className="w-full rounded-xl border px-3 py-2"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Şifre</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="min-w-[200px] flex-1">
              <p className="text-xs text-zinc-500">Mevcut şifre</p>
              <p className="font-mono text-sm">
                {showPassword
                  ? producer.decrypted_password || "Şifre çözülemedi"
                  : "••••••••"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            >
              {showPassword ? "Gizle" : "Şifreyi Göster"}
            </button>
            <button
              type="button"
              onClick={openPasswordModal}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Şifre Değiştir
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Ürün Ataması</h2>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Ürün ara"
              className="w-full max-w-xs rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 space-y-2">
            {sortedProducts.map((p) => {
              const assign = assignments[p.id] || {
                isActive: false,
                stockQuantity: 0,
              };
              return (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                    assign.isActive
                      ? "border-orange-200 bg-orange-50"
                      : "border-zinc-100 bg-zinc-50"
                  }`}
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm font-medium leading-snug">
                      {p.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {p.brand_name || "Manuel ürün"}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={assign.isActive}
                      onChange={(e) =>
                        updateAssignment(p.id, { isActive: e.target.checked })
                      }
                      className="h-5 w-5"
                    />
                    Üretiyor
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500">Stok</span>
                    <input
                      type="number"
                      min="0"
                      value={assign.stockQuantity}
                      onChange={(e) =>
                        updateAssignment(p.id, {
                          stockQuantity: e.target.value,
                        })
                      }
                      className="w-20 rounded-lg border px-2 py-1.5"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>

      {passwordModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Şifre Değiştir</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {producer.full_name || producer.username} için yeni şifre
                  belirleyin
                </p>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Yeni şifre</span>
              <input
                type="text"
                autoFocus
                value={modalPassword}
                onChange={(e) => setModalPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Yeni şifreyi yazın"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={passwordSaving}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={updatePassword}
                disabled={passwordSaving || !modalPassword.trim()}
                className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {passwordSaving ? "Güncelleniyor..." : "Şifre Güncelle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
