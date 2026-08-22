"use client";

import { useEffect, useMemo, useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import StorageImage from "@/components/StorageImage";
import { formatDate } from "@/lib/format";

const STATUS_LABEL = {
  pending: "Beklemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  archived: "Arşiv",
};

const FILTERS = [
  { key: "pending", label: "Beklemede" },
  { key: "all", label: "Tümü" },
  { key: "approved", label: "Onaylandı" },
  { key: "rejected", label: "Reddedildi" },
  { key: "archived", label: "Arşiv" },
];

function statusClass(status) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-rose-100 text-rose-700";
    case "archived":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export default function AdminProductRequestsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [updatingId, setUpdatingId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/product-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yüklenemedi");
      setRows(data.rows || []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  async function updateStatus(id, status) {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/product-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } catch {
      // sessiz
    }
    setUpdatingId("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Üretici Ürün Talepleri</h1>
        <p className="text-zinc-500">
          Üreticilerin gönderdiği ürün stok talepleri
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === f.key
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-zinc-50 text-zinc-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Talep bulunamadı
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <article
              key={row.id}
              className="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.title}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {row.profiles?.full_name || "Üretici"}
                    {row.profiles?.username
                      ? ` · @${row.profiles.username}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                    row.status
                  )}`}
                >
                  {STATUS_LABEL[row.status] || row.status}
                </span>
              </div>

              {row.image_url ? (
                <button
                  type="button"
                  onClick={() => setPreviewUrl(row.image_url)}
                  className="relative mt-3 h-40 w-full overflow-hidden rounded-xl bg-zinc-100"
                >
                  <StorageImage
                    src={row.image_url}
                    alt={row.title}
                    fill
                    className="object-cover"
                  />
                </button>
              ) : null}

              <p className="mt-3 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
                {row.description}
              </p>

              {row.profiles?.phone ? (
                <a
                  href={`tel:${row.profiles.phone}`}
                  className="mt-2 text-sm text-orange-700 hover:underline"
                >
                  {row.profiles.phone}
                </a>
              ) : null}

              <p className="mt-3 text-xs text-zinc-400">
                {formatDate(row.created_at)}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updatingId === row.id || row.status === "approved"}
                  onClick={() => updateStatus(row.id, "approved")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Onayla
                </button>
                <button
                  type="button"
                  disabled={updatingId === row.id || row.status === "rejected"}
                  onClick={() => updateStatus(row.id, "rejected")}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Reddet
                </button>
                <button
                  type="button"
                  disabled={updatingId === row.id || row.status === "pending"}
                  onClick={() => updateStatus(row.id, "pending")}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Beklemede
                </button>
                <button
                  type="button"
                  disabled={updatingId === row.id || row.status === "archived"}
                  onClick={() => updateStatus(row.id, "archived")}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Arşivle
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ImageLightbox
        src={previewUrl}
        alt="Ürün talebi görseli"
        onClose={() => setPreviewUrl("")}
      />
    </div>
  );
}
