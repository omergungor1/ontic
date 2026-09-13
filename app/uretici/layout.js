"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearSupabaseAuthCookies } from "@/lib/supabase/clear-auth-cookies";
import { useUnreadMessages } from "@/lib/useUnreadMessages";

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" {...props}>
      <path
        d="M3 11.5 12 4l9 7.5M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoxIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" {...props}>
      <path
        d="M21 8 12 3 3 8m18 0-9 5m9-5v9l-9 5m0-9L3 8m9 5v9M3 8v9l9 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TruckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" {...props}>
      <path
        d="M3 16V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v10M3 16h11m0 0h2.2a1 1 0 0 0 .95-.68L18.6 11H14v-3h3.2a1 1 0 0 1 .9.55L20 12v4h-2M3 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm11 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" {...props}>
      <path
        d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 12h4M15 12a1.5 1.5 0 1 0 0 3h4v-3h-4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" {...props}>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/uretici", label: "Ana", icon: HomeIcon, exact: true },
  { href: "/uretici/urunler", label: "Ürünler", icon: BoxIcon },
  { href: "/uretici/siparisler", label: "Siparişler", icon: TruckIcon },
  { href: "/uretici/odemeler", label: "Ödemeler", icon: WalletIcon },
  { href: "/uretici/mesajlar", label: "Mesajlar", icon: ChatIcon, showDot: true },
];

function MenuIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" {...props}>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" {...props}>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ProducerLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { hasUnread } = useUnreadMessages({
    role: "producer",
    clearOnPath: "/uretici/mesajlar",
    pathname,
  });

  useEffect(() => {
    if (pathname === "/giris") return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(prof);
    });
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (pathname === "/giris") {
    return children;
  }

  function requestLogout() {
    setMenuOpen(false);
    setLogoutOpen(true);
  }

  async function logout() {
    setLoggingOut(true);
    setMenuOpen(false);
    setLogoutOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    clearSupabaseAuthCookies();
    router.push("/giris");
  }

  const isMessages = pathname.startsWith("/uretici/mesajlar");

  return (
    <div
      className={
        isMessages
          ? "flex h-dvh flex-col overflow-hidden bg-stone-50"
          : "flex min-h-dvh flex-col bg-stone-50 pb-24"
      }
    >
      <header className="sticky top-0 z-40 shrink-0 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/logo.png" alt="Ontic" width={40} height={40} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">
                {profile?.full_name || "Üretici Paneli"}
              </p>
              <p className="text-xs text-zinc-500">Ontic Üretici Ağı</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Menüyü aç"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 sm:hidden"
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={requestLogout}
            className="hidden rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 sm:inline-flex"
          >
            Çıkış
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className="absolute inset-y-0 right-0 flex w-[min(20rem,86vw)] flex-col bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Menü"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">
                  {profile?.full_name || "Üretici"}
                </p>
                {profile?.username ? (
                  <p className="text-xs text-zinc-500">@{profile.username}</p>
                ) : (
                  <p className="text-xs text-zinc-500">Ontic Üretici Ağı</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Kapat"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {NAV_ITEMS.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active
                      ? "bg-orange-50 text-orange-700"
                      : "text-zinc-700 hover:bg-zinc-50"
                      }`}
                  >
                    <span className="relative">
                      <Icon className="h-5 w-5" />
                      {item.showDot && hasUnread ? (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" />
                      ) : null}
                    </span>
                    {item.label === "Ana" ? "Ana Sayfa" : item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-zinc-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={requestLogout}
                className="w-full rounded-xl border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-700"
              >
                Çıkış Yap
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {logoutOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="producer-logout-title"
          >
            <h3
              id="producer-logout-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Çıkış yapmak istiyor musunuz?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Üretici panelinden çıkış yapılacak. Tekrar giriş yapmanız
              gerekecek.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutOpen(false)}
                className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={logout}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {loggingOut ? "Çıkış yapılıyor..." : "Evet, çıkış yap"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main
        className={
          isMessages
            ? "mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col"
            : "mx-auto w-full max-w-2xl px-4 py-5"
        }
      >
        {children}
      </main>

      <nav
        className={`z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] ${isMessages
          ? "shrink-0"
          : "fixed inset-x-0 bottom-0"
          }`}
      >
        <div className="mx-auto flex max-w-2xl items-stretch justify-between">
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${active ? "text-orange-600" : "text-zinc-500"
                  }`}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" />
                  {item.showDot && hasUnread ? (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600 ring-2 ring-white" />
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
