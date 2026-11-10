import Link from "next/link";

export default function StoreShell({ children }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <img
              src="/logo.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full"
            />
            <span className="truncate text-lg font-semibold tracking-tight">
              Ontic
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2">
            <Link
              href="/uretici-bilgi"
              className="rounded-full bg-orange-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Üretici misiniz?
            </Link>
            <Link
              href="/giris"
              className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
            >
              Giriş
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ontic. El emeği ürünler.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/uretici-bilgi" className="hover:text-zinc-900">
              Üretici bilgi
            </Link>
            <a href="tel:+905425861590" className="hover:text-zinc-900">
              0542 586 15 90
            </a>
            <a
              href="https://wa.me/905425861590"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-900"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
