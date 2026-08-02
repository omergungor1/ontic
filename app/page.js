"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import PhoneInput from "@/components/PhoneInput";
import WomenSupportBanner from "@/components/WomenSupportBanner";
import { isValidTrMobile } from "@/lib/phone";

const SUPPORT_PHONE_DISPLAY = "0542 586 15 90";
const SUPPORT_PHONE_TEL = "+905425861590";
const SUPPORT_WHATSAPP = "https://wa.me/905425861590";
const TRENDYOL_STORE =
  "https://www.trendyol.com/magaza/m-m-198608";
const INSTAGRAM = "https://www.instagram.com/";

const WHY_ITEMS = [
  "El emeği ve kaliteli üretim",
  "Dayanıklı, özenle seçilmiş malzemeler",
  "Güvenli alışveriş ve müşteri koruması",
  "Hızlı kargo ve şeffaf iletişim",
  "Müşteri memnuniyeti odaklı hizmet",
];

const PRODUCTS = [
  {
    title: "El örgüsü banyo lifleri",
    text: "Doğal dokulu, uzun ömürlü ve günlük kullanıma uygun el örgüsü ürünler.",
  },
  {
    title: "Çeyizlik ürünler",
    text: "Özenle hazırlanan çeyizlik setler ve ev tekstili parçaları.",
  },
  {
    title: "Yeni ürünler",
    text: "Sezonluk ve yeni koleksiyonlar yakında Trendyol mağazamızda.",
  },
];

const PROMISE_ITEMS = [
  {
    title: "El yapımı özen",
    text: "Her ürün, deneyimli kadın üreticilerimizin el emeğiyle hazırlanır ve kontrol edilir.",
  },
  {
    title: "Müşteri koruması",
    text: "Trendyol güvencesiyle alışveriş yapar, sorunsuz iade ve destek süreçlerinden yararlanırsınız.",
  },
  {
    title: "Adil üretim ağı",
    text: "Siparişler, tüm üreticilere dengeli ve adil bir dağıtım anlayışıyla paylaşılır.",
  },
];

export default function LandingPage() {
  const [producerOpen, setProducerOpen] = useState(false);
  const [producerLoading, setProducerLoading] = useState(false);
  const [producerSuccess, setProducerSuccess] = useState(false);
  const [producerError, setProducerError] = useState("");
  const [producerForm, setProducerForm] = useState({
    fullName: "",
    phone: "",
    city: "",
    district: "",
  });

  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactForm, setContactForm] = useState({
    fullName: "",
    phone: "",
    message: "",
  });

  function openProducerModal() {
    setProducerOpen(true);
    setProducerSuccess(false);
    setProducerError("");
  }

  async function submitApplication(e) {
    e.preventDefault();
    setProducerLoading(true);
    setProducerError("");
    try {
      if (!isValidTrMobile(producerForm.phone)) {
        throw new Error("Telefon 05XX XXX XX XX formatında olmalıdır");
      }
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(producerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Başvuru gönderilemedi");
      setProducerSuccess(true);
      setProducerForm({ fullName: "", phone: "", city: "", district: "" });
    } catch (err) {
      setProducerError(err.message);
    } finally {
      setProducerLoading(false);
    }
  }

  async function submitContact(e) {
    e.preventDefault();
    setContactLoading(true);
    setContactError("");
    setContactSuccess(false);
    try {
      if (!isValidTrMobile(contactForm.phone)) {
        throw new Error("Telefon 05XX XXX XX XX formatında olmalıdır");
      }
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mesaj gönderilemedi");
      setContactSuccess(true);
      setContactForm({ fullName: "", phone: "", message: "" });
    } catch (err) {
      setContactError(err.message);
    } finally {
      setContactLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#14110f] text-[#f7f1ea]">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <a href="#anasayfa" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Ontic"
              width={48}
              height={48}
              className="rounded-full bg-white/10 p-1"
              priority
            />
            <span className="text-2xl font-semibold tracking-tight">ONTİC</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-white/85 md:flex">
            <a href="#hakkimizda" className="hover:text-white">
              Hakkımızda
            </a>
            <a href="#urunler" className="hover:text-white">
              Ürünler
            </a>
            <a href="#neden" className="hover:text-white">
              Neden Ontic
            </a>
            <a href="#iletisim" className="hover:text-white">
              İletişim
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/giris"
              className="rounded-full px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 sm:px-4"
            >
              Üretici Giriş
            </Link>
            <a
              href={TRENDYOL_STORE}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-zinc-900 sm:px-4"
            >
              Mağaza
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — full-bleed */}
        <section
          id="anasayfa"
          className="relative flex min-h-[100svh] items-end overflow-hidden"
        >
          <Image
            src="/landing/landing-hero-craft.jpg"
            alt="Ontic el emeği üretim"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#14110f] via-[#14110f]/70 to-[#14110f]/25" />
          <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-32 sm:px-6 sm:pb-20">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-orange-200">
              Ontic
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Ontic&apos;e hoş geldiniz
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              Kaliteli el örgüsü banyo lifleri ve çeyizlik ürünleriyle
              evlerinize şıklık ve konfor katıyoruz. Özenle üretilen
              ürünlerimizi Trendyol mağazamızdan güvenle satın alabilirsiniz.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={TRENDYOL_STORE}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-orange-600 px-6 py-3 text-base font-semibold text-white hover:bg-orange-500"
              >
                Trendyol&apos;da İncele
              </a>
              <a
                href="#iletisim"
                className="rounded-full border border-white/25 px-6 py-3 text-base font-medium text-white/95 hover:bg-white/10"
              >
                Bize ulaşın
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <WomenSupportBanner
            onCta={openProducerModal}
            ctaLabel="Üretici misiniz? Başvurun"
          />
        </section>

        <section
          id="hakkimizda"
          className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
            <Image
              src="/landing/landing-community.jpg"
              alt="Ontic kadın üretici topluluğu"
              fill
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 50vw"
            />
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-300/90">
              Hakkımızda
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              El emeğini ekonomiye taşıyan kurumsal bir girişim
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/75">
              Ontic, kadın üreticileri ekonomiye katan bir girişimdir. El emeği
              ürünleri profesyonel şekilde pazaryerlerinde satar; bu süreci
              üreticiler için de sürdürülebilir ve kazançlı kılar.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-white/75">
              Yaklaşık 10 yıllık tecrübe ve onlarca kadın üreticiyle yolumuza
              devam ediyoruz. Kaliteli malzeme, özenli üretim ve müşteri
              memnuniyeti işimizin merkezinde yer alır.
            </p>
          </div>
        </section>

        <section
          id="neden"
          className="border-y border-white/10 bg-black/25"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">
              Neden Ontic?
            </h2>
            <p className="mt-3 max-w-2xl text-white/70">
              El emeği, kaliteli malzeme ve müşteri memnuniyetini ön planda
              tutuyoruz. Her ürün özenle hazırlanır ve kontrol edilerek size
              ulaşır.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WHY_ITEMS.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white/85"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="urunler" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-end gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-300/90">
                Ürünlerimiz
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                El yapımı, özenle hazırlanmış koleksiyon
              </h2>
              <p className="mt-4 text-lg text-white/70">
                Banyo liflerinden çeyizlik ürünlere uzanan seçkimizi Trendyol
                mağazamızdan inceleyebilirsiniz.
              </p>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
              <Image
                src="/landing/landing-products.jpg"
                alt="Ontic el örgüsü ürünler"
                fill
                className="object-cover"
                sizes="(max-width:1024px) 100vw, 50vw"
              />
            </div>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PRODUCTS.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-white/70">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {PROMISE_ITEMS.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-orange-500/20 bg-orange-500/10 p-6"
              >
                <h3 className="text-xl font-semibold text-orange-100">
                  {item.title}
                </h3>
                <p className="mt-3 text-white/75">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 sm:p-10">
            <h2 className="text-3xl font-semibold tracking-tight">
              Müşteri yorumları
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-white/75">
              Trendyol mağazamızdaki gerçek müşteri değerlendirmeleri ve
              puanlarımızı inceleyerek alışveriş kararınızı güvenle
              verebilirsiniz.
            </p>
            <a
              href={TRENDYOL_STORE}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900"
            >
              Yorumları Trendyol&apos;da gör
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <WomenSupportBanner
            onCta={openProducerModal}
            ctaLabel="Ontic ailesine katılın"
          />
        </section>

        <section id="iletisim" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-300/90">
                İletişim
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Aklınızdaki soruları bize sorun
              </h2>
              <p className="mt-4 text-lg text-white/70">
                Ürün, sipariş veya üretici ağımız hakkında yazın; en kısa sürede
                dönüş yapalım.
              </p>
              <div className="mt-8 space-y-3 text-base">
                <a
                  href={`tel:${SUPPORT_PHONE_TEL}`}
                  className="block font-medium text-white hover:text-orange-200"
                >
                  Destek: {SUPPORT_PHONE_DISPLAY}
                </a>
                <a
                  href={SUPPORT_WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-white/80 hover:text-white"
                >
                  WhatsApp ile yazın
                </a>
                <a
                  href="mailto:onticbursa@gmail.com"
                  className="block text-white/80 hover:text-white"
                >
                  onticbursa@gmail.com
                </a>
                <a
                  href={INSTAGRAM}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-white/80 hover:text-white"
                >
                  Instagram
                </a>
              </div>
            </div>

            <form
              onSubmit={submitContact}
              className="rounded-[2rem] border border-white/10 bg-white p-6 text-zinc-900 sm:p-8"
            >
              <h3 className="text-xl font-semibold">İletişim formu</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Ad soyad, telefon ve mesajınızı bırakın.
              </p>

              {contactSuccess ? (
                <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-5 text-emerald-800">
                  Mesajınız alındı. En kısa sürede sizinle iletişime
                  geçeceğiz.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      Ad Soyad
                    </span>
                    <input
                      required
                      type="text"
                      value={contactForm.fullName}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          fullName: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none ring-orange-500 focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      Telefon
                    </span>
                    <PhoneInput
                      required
                      value={contactForm.phone}
                      onChange={(phone) =>
                        setContactForm((prev) => ({ ...prev, phone }))
                      }
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none ring-orange-500 focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      Mesaj
                    </span>
                    <textarea
                      required
                      rows={4}
                      value={contactForm.message}
                      onChange={(e) =>
                        setContactForm((prev) => ({
                          ...prev,
                          message: e.target.value,
                        }))
                      }
                      className="w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none ring-orange-500 focus:ring-2"
                      placeholder="Size nasıl yardımcı olabiliriz?"
                    />
                  </label>
                  {contactError ? (
                    <p className="text-sm text-rose-600">{contactError}</p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={
                      contactLoading || !isValidTrMobile(contactForm.phone)
                    }
                    className="w-full rounded-xl bg-orange-600 py-3 text-base font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
                  >
                    {contactLoading ? "Gönderiliyor..." : "Mesajı gönder"}
                  </button>
                </div>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Ontic"
                width={40}
                height={40}
                className="rounded-full bg-white/10 p-1"
              />
              <span className="text-xl font-semibold">ONTİC</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
              El emeği ürünleri profesyonel pazaryerleriyle buluşturan, kadın
              üreticileri destekleyen kurumsal girişim.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Kurumsal</p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>
                <a href="#hakkimizda" className="hover:text-white">
                  Hakkımızda
                </a>
              </li>
              <li>
                <a href="#urunler" className="hover:text-white">
                  Ürünlerimiz
                </a>
              </li>
              <li>
                <a href="#neden" className="hover:text-white">
                  Neden Ontic
                </a>
              </li>
              <li>
                <a href="#iletisim" className="hover:text-white">
                  İletişim
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">İletişim</p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>
                <a
                  href={`tel:${SUPPORT_PHONE_TEL}`}
                  className="hover:text-white"
                >
                  {SUPPORT_PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a
                  href={SUPPORT_WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="mailto:onticbursa@gmail.com"
                  className="hover:text-white"
                >
                  E-posta
                </a>
              </li>
              <li>
                <a
                  href={TRENDYOL_STORE}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                >
                  Trendyol Mağaza
                </a>
              </li>
              <li>
                <a
                  href={INSTAGRAM}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/45 sm:px-6">
          © {new Date().getFullYear()} Ontic. Tüm hakları saklıdır.
        </div>
      </footer>

      {producerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">Üretici Kayıt Formu</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Bilgilerinizi bırakın, en kısa sürede dönüş yapalım.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProducerOpen(false)}
                className="rounded-full px-3 py-1 text-zinc-500 hover:bg-zinc-100"
              >
                Kapat
              </button>
            </div>

            {producerSuccess ? (
              <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-5 text-emerald-800">
                Talebiniz başarıyla oluşturuldu. En kısa sürede size dönüş
                sağlayacağız. İlginiz için teşekkürler.
              </div>
            ) : (
              <form onSubmit={submitApplication} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Ad Soyad
                  </span>
                  <input
                    required
                    type="text"
                    value={producerForm.fullName}
                    onChange={(e) =>
                      setProducerForm((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none ring-orange-500 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Telefon
                  </span>
                  <PhoneInput
                    required
                    value={producerForm.phone}
                    onChange={(phone) =>
                      setProducerForm((prev) => ({ ...prev, phone }))
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none ring-orange-500 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Şehir</span>
                  <input
                    required
                    type="text"
                    value={producerForm.city}
                    onChange={(e) =>
                      setProducerForm((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none ring-orange-500 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">İlçe</span>
                  <input
                    required
                    type="text"
                    value={producerForm.district}
                    onChange={(e) =>
                      setProducerForm((prev) => ({
                        ...prev,
                        district: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none ring-orange-500 focus:ring-2"
                  />
                </label>
                {producerError ? (
                  <p className="text-sm text-rose-600">{producerError}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={
                    producerLoading || !isValidTrMobile(producerForm.phone)
                  }
                  className="w-full rounded-xl bg-orange-600 py-3 text-base font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
                >
                  {producerLoading ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
