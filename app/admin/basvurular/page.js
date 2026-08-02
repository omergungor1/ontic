"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";

const STATUS_LABEL = {
  pending: "Beklemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "pending", label: "Beklemede" },
  { key: "approved", label: "Onaylandı" },
  { key: "rejected", label: "Reddedildi" },
];

function statusClass(status) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [updatingId, setUpdatingId] = useState("");

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("producer_applications")
      .select("*")
      .order("created_at", { ascending: false });
    setApplications(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return applications;
    return applications.filter((a) => a.status === filter);
  }, [applications, filter]);

  async function updateStatus(id, status) {
    setUpdatingId(id);
    const supabase = createClient();
    await supabase.from("producer_applications").update({ status }).eq("id", id);
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    setUpdatingId("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Üretici Başvuruları</h1>
        <p className="text-zinc-500">Ana sayfadan gelen başvuru talepleri</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === f.key
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 border border-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          Başvuru bulunamadı
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((app) => (
            <div
              key={app.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{app.full_name}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                    app.status
                  )}`}
                >
                  {STATUS_LABEL[app.status] || app.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                📞 {app.phone}
              </p>
              <p className="text-sm text-zinc-600">
                📍 {[app.city, app.district].filter(Boolean).join(" / ")}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {formatDate(app.created_at)}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={updatingId === app.id || app.status === "approved"}
                  onClick={() => updateStatus(app.id, "approved")}
                  className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Onayla
                </button>
                <button
                  type="button"
                  disabled={updatingId === app.id || app.status === "rejected"}
                  onClick={() => updateStatus(app.id, "rejected")}
                  className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Reddet
                </button>
                <button
                  type="button"
                  disabled={updatingId === app.id || app.status === "pending"}
                  onClick={() => updateStatus(app.id, "pending")}
                  className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Beklemede
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
