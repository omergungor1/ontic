"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProducerLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const clean = username.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const email = `${clean}@ontic.com.tr`;
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) throw signError;
      window.location.href = "/uretici";
    } catch {
      setError(
        "Giriş yapamıyorsanız lütfen WhatsApp üzerinden iletişime geçiniz."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="Ontic"
            width={72}
            height={72}
            className="mx-auto rounded-full"
          />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Üretici Girişi
          </h1>
          <p className="mt-2 text-zinc-500">Kullanıcı adı ve şifrenizle girin</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-base font-medium">Kullanıcı adı</span>
            <input
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")
                )
              }
              autoComplete="username"
              required
              pattern="[a-z0-9]+"
              className="w-full rounded-2xl border border-zinc-200 px-4 py-4 text-lg outline-none ring-orange-500 focus:ring-2"
              placeholder="ornek: halimederin"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-base font-medium">Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-zinc-200 px-4 py-4 text-lg outline-none ring-orange-500 focus:ring-2"
            />
          </label>
          {error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-base text-rose-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-orange-600 py-4 text-lg font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-6 block text-center text-base text-zinc-500 hover:text-zinc-800"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
