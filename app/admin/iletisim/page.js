"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";

const STATUS_LABEL = {
  new: "Yeni",
  read: "Okundu",
  archived: "Arşiv",
};

const FILTERS = [
  { key: "new", label: "Yeni" },
  { key: "all", label: "Tümü" },
  { key: "read", label: "Okundu" },
  { key: "archived", label: "Arşiv" },
];

function statusClass(status) {
  switch (status) {
    case "new":
      return "bg-rose-100 text-rose-700";
    case "read":
      return "bg-sky-100 text-sky-700";
    case "archived":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export default function AdminContactPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("new");
  const [updatingId, setUpdatingId] = useState("");

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data || []);
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
    const supabase = createClient();
    const { error } = await supabase
      .from("contact_messages")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
    setUpdatingId("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">İletişim Formu</h1>
        <p className="text-zinc-500">Ana sayfadan gelen müşteri mesajları</p>
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
          Mesaj bulunamadı
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <article
              key={row.id}
              className="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-semibold">{row.full_name}</p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                    row.status
                  )}`}
                >
                  {STATUS_LABEL[row.status] || row.status}
                </span>
              </div>
              <a
                href={`tel:${row.phone}`}
                className="mt-2 text-sm text-orange-700 hover:underline"
              >
                {row.phone}
              </a>
              <p className="mt-3 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
                {row.message}
              </p>
              <p className="mt-3 text-xs text-zinc-400">
                {formatDate(row.created_at)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updatingId === row.id || row.status === "read"}
                  onClick={() => updateStatus(row.id, "read")}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Okundu
                </button>
                <button
                  type="button"
                  disabled={updatingId === row.id || row.status === "archived"}
                  onClick={() => updateStatus(row.id, "archived")}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Arşivle
                </button>
                <button
                  type="button"
                  disabled={updatingId === row.id || row.status === "new"}
                  onClick={() => updateStatus(row.id, "new")}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Yeni
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
