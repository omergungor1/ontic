"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUnreadMessages } from "@/lib/useUnreadMessages";

const LINKS = [
  { href: "/admin", label: "Özet" },
  { href: "/admin/siparisler", label: "Siparişler" },
  { href: "/admin/uretici-siparisler", label: "Üretici Siparişleri" },
  { href: "/admin/urunler", label: "Ürünler" },
  { href: "/admin/ureticiler", label: "Üreticiler" },
  { href: "/admin/stok", label: "Stok" },
  { href: "/admin/kasa", label: "Kasa" },
  { href: "/admin/mesajlar", label: "Mesajlar", badge: "messages" },
  { href: "/admin/duyurular", label: "Duyurular" },
  { href: "/admin/basvurular", label: "Başvurular", badge: "applications" },
  { href: "/admin/iletisim", label: "İletişim Formu", badge: "contact" },
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

function NavBadge({ active, count, dense }) {
  if (!count) return null;
  return (
    <span
      className={`inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
        dense ? "ml-auto" : "ml-1.5"
      } ${
        active
          ? "bg-white text-orange-700"
          : "animate-pulse bg-rose-600 text-white"
      }`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingApps, setPendingApps] = useState(0);
  const [newContacts, setNewContacts] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { hasUnread, unreadCount } = useUnreadMessages({
    role: "admin",
    clearOnPath: "/admin/mesajlar",
    pathname,
  });

  useEffect(() => {
    if (pathname === "/admin/giris") return undefined;

    const supabase = createClient();

    async function loadPendingApps() {
      const { count, error } = await supabase
        .from("producer_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!error) setPendingApps(count || 0);
    }

    async function loadNewContacts() {
      const { count, error } = await supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (!error) setNewContacts(count || 0);
    }

    loadPendingApps();
    loadNewContacts();

    const channel = supabase
      .channel("admin-pending-badges")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "producer_applications",
        },
        () => {
          loadPendingApps();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_messages",
        },
        () => {
          loadNewContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  if (pathname === "/admin/giris") {
    return children;
  }

  async function logout() {
    setLoggingOut(true);
    setMenuOpen(false);
    setLogoutOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/giris");
  }

  function requestLogout() {
    setMenuOpen(false);
    setLogoutOpen(true);
  }

  function badgeCount(link) {
    if (link.badge === "messages" && hasUnread) return unreadCount || 1;
    if (link.badge === "applications") return pendingApps;
    if (link.badge === "contact") return newContacts;
    return 0;
  }

  function isActive(href) {
    return (
      pathname === href || (href !== "/admin" && pathname.startsWith(href))
    );
  }

  const alertTotal =
    (hasUnread ? unreadCount || 1 : 0) +
    (pendingApps || 0) +
    (newContacts || 0);
  const isMessages = pathname.startsWith("/admin/mesajlar");

  return (
    <div
      className={
        isMessages
          ? "flex h-dvh flex-col overflow-hidden bg-zinc-100"
          : "min-h-screen bg-zinc-100"
      }
    >
      <header className="sticky top-0 z-40 shrink-0 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/logo.png" alt="Ontic" width={36} height={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Ontic Admin</p>
              <p className="text-xs text-zinc-500">Yönetim paneli</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Menüyü aç"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 lg:hidden"
          >
            <MenuIcon className="h-6 w-6" />
            {alertTotal > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                {alertTotal > 9 ? "9+" : alertTotal}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={requestLogout}
            className="hidden items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 lg:inline-flex"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Çıkış
          </button>
        </div>

        <nav className="mx-auto hidden max-w-7xl gap-1 px-2 pb-2 lg:flex">
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-orange-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {link.label}
                <NavBadge active={active} count={badgeCount(link)} />
              </Link>
            );
          })}
        </nav>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Yönetici menü"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">Ontic Admin</p>
                <p className="text-xs text-zinc-500">Yönetim paneli</p>
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
              {LINKS.map((link) => {
                const active = isActive(link.href);
                const count = badgeCount(link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                      active
                        ? "bg-orange-50 text-orange-700"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{link.label}</span>
                    <NavBadge active={false} count={count} dense />
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-zinc-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={requestLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
            aria-labelledby="admin-logout-title"
          >
            <h3
              id="admin-logout-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Çıkış yapmak istiyor musunuz?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Yönetici panelinden çıkış yapılacak. Tekrar giriş yapmanız
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
            ? "mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col lg:px-4 lg:py-6"
            : "mx-auto w-full max-w-7xl min-w-0 px-4 py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}
