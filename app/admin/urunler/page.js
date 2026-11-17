"use client";

import StorageImage from "@/components/StorageImage";
import StarIcon from "@/components/StarIcon";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, truncate } from "@/lib/format";

const SORT_OPTIONS = [
  { value: "default", label: "Varsayılan" },
  { value: "name-asc", label: "İsim (A → Z)" },
  { value: "name-desc", label: "İsim (Z → A)" },
  { value: "price-asc", label: "Satış fiyatı (artan)" },
  { value: "price-desc", label: "Satış fiyatı (azalan)" },
  { value: "producer-asc", label: "Üretici fiyatı (artan)" },
  { value: "producer-desc", label: "Üretici fiyatı (azalan)" },
];

function salePriceOf(product) {
  return Number(product.product_variants?.[0]?.sale_price || 0);
}

function hasProducerPrice(product) {
  return Number(product.producer_price || 0) > 0;
}

function hasMaterialSupport(product) {
  return Number(product.material_support || 0) > 0;
}

function isStarredProduct(product) {
  return Boolean(product.is_starred);
}

function draftNumber(raw) {
  if (raw === "" || raw == null) return 0;
  const value = Number(raw);
  return Number.isNaN(value) ? 0 : value;
}

function isPricingDirty(product, priceDrafts, materialDrafts, starDrafts, starBonusDrafts) {
  const savedPrice = Number(product.producer_price || 0);
  const savedMaterial = Number(product.material_support || 0);
  const savedBonus = Number(product.star_bonus || 0);
  const draftBonus = draftNumber(starBonusDrafts[product.id]);
  return (
    draftNumber(priceDrafts[product.id]) !== savedPrice ||
    draftNumber(materialDrafts[product.id]) !== savedMaterial ||
    Boolean(starDrafts[product.id]) !== Boolean(product.is_starred) ||
    draftBonus !== savedBonus
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [savingPriceId, setSavingPriceId] = useState(null);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [materialDrafts, setMaterialDrafts] = useState({});
  const [starDrafts, setStarDrafts] = useState({});
  const [starBonusDrafts, setStarBonusDrafts] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [missingProducerPrice, setMissingProducerPrice] = useState(false);
  const [hasMaterialSupportFilter, setHasMaterialSupportFilter] =
    useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    title: "",
    description: "",
    salePrice: "",
    producerPrice: "",
    materialSupport: "",
    starred: false,
    starBonus: "",
    stockCode: "",
  });

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*, product_variants(*)")
      .order("updated_at", { ascending: false });
    const list = data || [];
    setProducts(list);
    setPriceDrafts(
      Object.fromEntries(
        list.map((p) => [
          p.id,
          p.producer_price != null && p.producer_price !== ""
            ? String(p.producer_price)
            : "",
        ])
      )
    );
    setMaterialDrafts(
      Object.fromEntries(
        list.map((p) => [
          p.id,
          Number(p.material_support || 0) > 0
            ? String(p.material_support)
            : "",
        ])
      )
    );
    setStarDrafts(
      Object.fromEntries(list.map((p) => [p.id, Boolean(p.is_starred)]))
    );
    setStarBonusDrafts(
      Object.fromEntries(
        list.map((p) => [
          p.id,
          Number(p.star_bonus || 0) > 0 ? String(p.star_bonus) : "",
        ])
      )
    );
    setLoading(false);
  }

  async function saveProductPricing(product) {
    const priceRaw = priceDrafts[product.id];
    const materialRaw = materialDrafts[product.id];
    const bonusRaw = starBonusDrafts[product.id];
    const producerPrice = Number(
      priceRaw === "" || priceRaw == null ? 0 : priceRaw
    );
    const materialSupport = Number(
      materialRaw === "" || materialRaw == null ? 0 : materialRaw
    );
    const starred = Boolean(starDrafts[product.id]);
    const starBonus = Number(
      bonusRaw === "" || bonusRaw == null ? 0 : bonusRaw
    );
    if (Number.isNaN(producerPrice) || producerPrice < 0) {
      setMessage("Geçerli bir üretici fiyatı girin");
      return;
    }
    if (Number.isNaN(materialSupport) || materialSupport < 0) {
      setMessage("Geçerli bir malzeme desteği girin");
      return;
    }
    if (Number.isNaN(starBonus) || starBonus < 0) {
      setMessage("Geçerli bir yıldızlı ürün bonusu girin");
      return;
    }
    setSavingPriceId(product.id);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({
        producer_price: producerPrice,
        material_support: materialSupport,
        is_starred: starred,
        star_bonus: starred ? starBonus : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`"${product.title}" fiyatları güncellendi`);
      await load();
    }
    setSavingPriceId(null);
  }

  useEffect(() => {
    load();
  }, []);

  async function syncProducts() {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "products" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`${data.synced} ürün senkronlandı`);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function toggleActive(product) {
    const supabase = createClient();
    await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    await load();
  }

  async function addManual(e) {
    e.preventDefault();
    const supabase = createClient();
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        title: manual.title,
        description: manual.description,
        is_manual: true,
        is_active: true,
        image_url: null,
        images: [],
        producer_price: Number(manual.producerPrice || 0),
        material_support: Number(manual.materialSupport || 0),
        is_starred: Boolean(manual.starred),
        star_bonus: manual.starred ? Number(manual.starBonus || 0) : 0,
      })
      .select("id")
      .single();
    if (error) {
      setMessage(error.message);
      return;
    }
    await supabase.from("product_variants").insert({
      product_id: product.id,
      barcode: `MANUAL-${Date.now()}`,
      stock_code: manual.stockCode || null,
      sale_price: Number(manual.salePrice || 0),
      list_price: Number(manual.salePrice || 0),
      on_sale: true,
    });
    setManualOpen(false);
    setManual({
      title: "",
      description: "",
      salePrice: "",
      producerPrice: "",
      materialSupport: "",
      starred: false,
      starBonus: "",
      stockCode: "",
    });
    await load();
  }

  const filterActive =
    Boolean(searchQuery.trim()) ||
    sortBy !== "default" ||
    missingProducerPrice ||
    hasMaterialSupportFilter ||
    starredOnly ||
    activeFilter !== "all";

  const query = searchQuery.trim().toLocaleLowerCase("tr");
  let visibleProducts = products;
  if (query) {
    visibleProducts = visibleProducts.filter((product) =>
      String(product.title || "")
        .toLocaleLowerCase("tr")
        .includes(query)
    );
  }
  if (activeFilter === "active") {
    visibleProducts = visibleProducts.filter((product) => product.is_active);
  } else if (activeFilter === "passive") {
    visibleProducts = visibleProducts.filter((product) => !product.is_active);
  }
  if (missingProducerPrice) {
    visibleProducts = visibleProducts.filter(
      (product) => !hasProducerPrice(product)
    );
  }
  if (hasMaterialSupportFilter) {
    visibleProducts = visibleProducts.filter((product) =>
      hasMaterialSupport(product)
    );
  }
  if (starredOnly) {
    visibleProducts = visibleProducts.filter((product) =>
      isStarredProduct(product)
    );
  }
  if (sortBy !== "default") {
    visibleProducts = [...visibleProducts].sort((a, b) => {
      const nameA = String(a.title || "");
      const nameB = String(b.title || "");
      const priceA = salePriceOf(a);
      const priceB = salePriceOf(b);
      const producerA = Number(a.producer_price || 0);
      const producerB = Number(b.producer_price || 0);

      switch (sortBy) {
        case "name-asc":
          return nameA.localeCompare(nameB, "tr");
        case "name-desc":
          return nameB.localeCompare(nameA, "tr");
        case "price-asc":
          return priceA - priceB;
        case "price-desc":
          return priceB - priceA;
        case "producer-asc":
          return producerA - producerB;
        case "producer-desc":
          return producerB - producerA;
        default:
          return 0;
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Ürünler</h1>
          <p className="text-zinc-500">Trendyol sync ve manuel ürün ekleme</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filterOpen || filterActive
                ? "border-orange-300 bg-orange-50 text-orange-700"
                : "border-zinc-300 bg-white text-zinc-800"
            }`}
          >
            Filtre{filterOpen ? " ▴" : " ▾"}
          </button>
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
          >
            Manuel ürün ekle
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={syncProducts}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {syncing ? "Sync..." : "Trendyol Sync"}
          </button>
        </div>
      </div>

      {filterOpen ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                İsim ile ara
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ürün adı yazın..."
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Sıralama
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Durum
              </span>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="all">Tümü</option>
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={missingProducerPrice}
                onChange={(e) => setMissingProducerPrice(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>Üretici fiyatı girilmemiş</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={hasMaterialSupportFilter}
                onChange={(e) =>
                  setHasMaterialSupportFilter(e.target.checked)
                }
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>Malzeme desteği olanlar</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={starredOnly}
                onChange={(e) => setStarredOnly(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300"
              />
              <span className="inline-flex items-center gap-1.5">
                <StarIcon className="h-4 w-4 text-amber-500" />
                Yıldızlı ürünler
              </span>
            </label>
          </div>
          {filterActive ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSortBy("default");
                setMissingProducerPrice(false);
                setHasMaterialSupportFilter(false);
                setStarredOnly(false);
                setActiveFilter("all");
              }}
              className="mt-3 text-sm font-medium text-orange-700 hover:underline"
            >
              Filtreleri temizle
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}

      {loading ? (
        <p>Yükleniyor...</p>
      ) : products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-base text-zinc-500">
          Henüz ürün yok
        </p>
      ) : visibleProducts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-base text-zinc-500">
          Filtreye uygun ürün bulunamadı
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => {
            const variant = product.product_variants?.[0];
            const pricingDirty = isPricingDirty(
              product,
              priceDrafts,
              materialDrafts,
              starDrafts,
              starBonusDrafts
            );
            const starred = Boolean(starDrafts[product.id]);
            return (
              <article
                key={product.id}
                className={`overflow-hidden rounded-2xl border bg-white ${
                  starred ? "border-amber-300" : "border-zinc-200"
                }`}
              >
                <div className="relative aspect-[4/3] bg-zinc-100">
                  {product.image_url ? (
                    <StorageImage
                      src={product.image_url}
                      alt={product.title}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                  {starred ? (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950">
                      <StarIcon className="h-3.5 w-3.5" />
                      Yıldızlı
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-snug">{product.title}</h2>
                    <button
                      type="button"
                      onClick={() => toggleActive(product)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        product.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {product.is_active ? "Aktif" : "Pasif"}
                    </button>
                  </div>
                  <p className="text-sm text-zinc-600">
                    {truncate(product.description, 100)}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span>Satış: {formatPrice(variant?.sale_price)}</span>
                    <span className="text-zinc-500">
                      {product.brand_name || "Manuel"}
                    </span>
                  </div>
                  <div className="space-y-2 rounded-xl bg-zinc-50 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-xs font-medium text-zinc-600">
                        Üretici fiyatı (sabit) ₺
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={priceDrafts[product.id] ?? ""}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900"
                          placeholder="0"
                        />
                      </label>
                      <label className="block text-xs font-medium text-zinc-600">
                        Malzeme desteği ₺
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={materialDrafts[product.id] ?? ""}
                          onChange={(e) =>
                            setMaterialDrafts((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900"
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      aria-pressed={starred}
                      onClick={() =>
                        setStarDrafts((prev) => ({
                          ...prev,
                          [product.id]: !starred,
                        }))
                      }
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                        starred
                          ? "border-amber-300 bg-amber-100 text-amber-900"
                          : "border-zinc-200 bg-white text-zinc-600"
                      }`}
                    >
                      <StarIcon
                        className="h-4 w-4"
                        filled={starred}
                      />
                      Yıldızlı ürün
                    </button>
                    {starred ? (
                      <label className="block text-xs font-medium text-amber-800">
                        Yıldızlı ürün bonusu ₺
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={starBonusDrafts[product.id] ?? ""}
                          onChange={(e) =>
                            setStarBonusDrafts((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900"
                          placeholder="0"
                        />
                      </label>
                    ) : null}
                    {pricingDirty ? (
                      <button
                        type="button"
                        disabled={savingPriceId === product.id}
                        onClick={() => saveProductPricing(product)}
                        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {savingPriceId === product.id
                          ? "Kaydediliyor..."
                          : "Kaydet"}
                      </button>
                    ) : null}
                    <p className="text-[11px] text-zinc-500">
                      Üretici fiyatı ve malzeme desteği tüm üreticiler için
                      aynıdır, siparişe atama anında kilitlenir. Yıldızlı ürün
                      bonusu, üretici stoğa ekleyince hesabına yazılır.
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {manualOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={addManual}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5"
          >
            <h3 className="text-lg font-semibold">Manuel ürün</h3>
            <input
              required
              placeholder="Ürün adı"
              value={manual.title}
              onChange={(e) =>
                setManual((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <textarea
              placeholder="Açıklama"
              value={manual.description}
              onChange={(e) =>
                setManual((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <input
              placeholder="Satış fiyatı"
              value={manual.salePrice}
              onChange={(e) =>
                setManual((prev) => ({ ...prev, salePrice: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="Üretici fiyatı (sabit) ₺"
              value={manual.producerPrice}
              onChange={(e) =>
                setManual((prev) => ({
                  ...prev,
                  producerPrice: e.target.value,
                }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="Malzeme desteği ₺"
              value={manual.materialSupport}
              onChange={(e) =>
                setManual((prev) => ({
                  ...prev,
                  materialSupport: e.target.value,
                }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={manual.starred}
                onChange={(e) =>
                  setManual((prev) => ({ ...prev, starred: e.target.checked }))
                }
                className="h-4 w-4"
              />
              Yıldızlı ürün
            </label>
            {manual.starred ? (
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="Yıldızlı ürün bonusu ₺"
                value={manual.starBonus}
                onChange={(e) =>
                  setManual((prev) => ({ ...prev, starBonus: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2"
              />
            ) : null}
            <input
              placeholder="Stok kodu"
              value={manual.stockCode}
              onChange={(e) =>
                setManual((prev) => ({ ...prev, stockCode: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="flex-1 rounded-xl border py-2"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-orange-600 py-2 text-white"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
