import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-100 px-4 py-12">
      <div
        className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-16 h-80 w-80 rounded-full bg-rose-300/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <Image
          src="/logo.png"
          alt="Ontic"
          width={64}
          height={64}
          className="mx-auto rounded-full"
          priority
        />

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
          Ontic
        </p>

        <p
          className="mt-3 bg-gradient-to-br from-orange-600 to-rose-600 bg-clip-text text-7xl font-bold tabular-nums leading-none text-transparent"
          aria-hidden="true"
        >
          404
        </p>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
          Sayfa bulunamadı
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-500">
          Aradığınız sayfa taşınmış, silinmiş veya hiç var olmamış olabilir.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="rounded-2xl bg-orange-600 py-3.5 text-base font-semibold text-white transition hover:bg-orange-500"
          >
            Ana sayfaya dön
          </Link>
          <Link
            href="/giris"
            className="rounded-2xl border border-zinc-200 bg-zinc-50 py-3.5 text-base font-medium text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            Üretici girişi
          </Link>
        </div>
      </div>
    </div>
  );
}
