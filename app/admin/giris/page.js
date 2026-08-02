"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) throw signError;
      window.location.href = "/admin";
    } catch (err) {
      setError(err.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8">
        <div className="mb-8 flex items-center gap-3">
          <Image src="/logo.png" alt="Ontic" width={48} height={48} />
          <div>
            <h1 className="text-2xl font-semibold">Admin Girişi</h1>
            <p className="text-sm text-zinc-500">Mail ve şifre ile giriş</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-posta"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none ring-orange-500 focus:ring-2"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none ring-orange-500 focus:ring-2"
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Giriş..." : "Giriş Yap"}
          </button>
        </form>
        <Link href="/" className="mt-4 block text-center text-sm text-zinc-500">
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
