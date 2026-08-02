"use client";

export default function WomenSupportBanner({
  onCta,
  ctaLabel = "Ontic ailesine katılın",
  className = "",
}) {
  return (
    <div
      className={`rounded-[2rem] bg-gradient-to-br from-orange-600 to-rose-700 p-8 sm:p-12 ${className}`}
    >
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-100/90">
        Ontic Ailesi
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Kadın üreticileri destekliyoruz
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/90">
        Ontic; kadın üreticileri ekonomiye katan bir girişimdir. El emeği
        ürünleri profesyonel şekilde pazaryerlerinde buluşturur, süreci üretici
        için sürdürülebilir ve kazançlı hale getirir. Yaklaşık 10 yıllık tecrübe
        ve onlarca kadın üreticiyle bu yolculuğa birlikte devam ediyoruz.
      </p>
      {onCta ? (
        <button
          type="button"
          onClick={onCta}
          className="mt-8 rounded-full bg-white px-6 py-3 text-base font-semibold text-orange-700 transition hover:bg-orange-50"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
