"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StorageImage from "@/components/StorageImage";
import { formatPrice } from "@/lib/format";
import { PAGE_SIZE, storeImage } from "@/lib/storefront";

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
}

function pageNumbers(current, total) {
  const pages = [];
  const push = (value) => {
    if (!pages.includes(value)) pages.push(value);
  };
  push(1);
  for (let page = current - 1; page <= current + 1; page += 1) {
    if (page > 1 && page < total) push(page);
  }
  if (total > 1) push(total);
  return pages;
}

export default function Catalog({ products }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useMemo(
    () => uniqueSorted(products.map((product) => product.category)),
    [products]
  );

  const filtersActive = Boolean(category) || sort !== "name";

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr");
    const list = products.filter((product) => {
      if (category && product.category !== category) return false;
      if (!term) return true;
      const haystack = `${product.title} ${product.brand} ${product.category}`
        .toLocaleLowerCase("tr");
      return haystack.includes(term);
    });

    list.sort((a, b) => {
      if (sort === "price-asc") {
        return (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER);
      }
      if (sort === "price-desc") return (b.price || 0) - (a.price || 0);
      return a.title.localeCompare(b.title, "tr");
    });
    return list;
  }, [products, query, category, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function update(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  function resetFilters() {
    setQuery("");
    setCategory("");
    setSort("name");
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            El emeği ürünler
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
            Kadın üreticilerimizin el emeği, göz nuru; ilmek ilmek işlediği
            ürünleri keşfedin.
          </p>
        </div>
        <p className="text-sm text-zinc-500">{filtered.length} ürün</p>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Ürün ara</span>
          <input
            value={query}
            onChange={(event) => update(setQuery)(event.target.value)}
            placeholder="Ürün ara"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none ring-orange-500 focus:ring-2"
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          aria-label={filtersOpen ? "Filtreleri gizle" : "Filtreleri göster"}
          className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition ${
            filtersOpen || filtersActive
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <FilterIcon />
          {filtersActive ? (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-orange-400" />
          ) : null}
        </button>
      </div>

      {filtersOpen ? (
        <div
          id="catalog-filters"
          className="mt-3 space-y-3 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4"
        >
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500">Kategori</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <FilterChip
                active={!category}
                onClick={() => update(setCategory)("")}
                label="Tümü"
              />
              {categories.map((item) => (
                <FilterChip
                  key={item}
                  active={category === item}
                  onClick={() => update(setCategory)(item)}
                  label={item}
                />
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Sırala
            </span>
            <select
              value={sort}
              onChange={(event) => update(setSort)(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none ring-orange-500 focus:ring-2"
            >
              <option value="name">Ada göre</option>
              <option value="price-asc">Fiyat: artan</option>
              <option value="price-desc">Fiyat: azalan</option>
            </select>
          </label>

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setCategory("");
                setSort("name");
                setPage(1);
              }}
              className="text-sm font-medium text-orange-700"
            >
              Filtreleri temizle
            </button>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <p className="text-base font-medium">Bu filtreye uygun ürün yok.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Filtreleri temizle
          </button>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => (
            <li key={product.id}>
              <Link
                href={`/urun/${product.id}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="relative aspect-square bg-zinc-100">
                  {product.image ? (
                    <StorageImage
                      src={storeImage(product.image, 480)}
                      alt={product.title}
                      fill
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                      Görsel yok
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {product.category || product.brand || "Ontic"}
                  </p>
                  <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
                    {product.title}
                  </h2>
                  <div className="mt-auto pt-3">
                    {product.listPrice > product.price && product.price > 0 ? (
                      <p className="text-xs text-zinc-400 line-through">
                        {formatPrice(product.listPrice)}
                      </p>
                    ) : null}
                    <p className="text-sm font-semibold text-orange-700">
                      {product.price > 0 ? formatPrice(product.price) : "Fiyat sorunuz"}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          className="mt-6 flex items-center justify-between gap-2"
          aria-label="Sayfalar"
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            Önceki
          </button>
          <div className="flex items-center gap-1">
            {pageNumbers(currentPage, pageCount).map((number, index, list) => {
              const previous = list[index - 1];
              return (
                <span key={number} className="flex items-center gap-1">
                  {previous && number - previous > 1 ? (
                    <span className="px-1 text-zinc-400">…</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPage(number)}
                    aria-current={number === currentPage ? "page" : undefined}
                    className={`h-10 w-10 rounded-xl text-sm font-semibold ${
                      number === currentPage
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-700"
                    }`}
                  >
                    {number}
                  </button>
                </span>
              );
            })}
          </div>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            Sonraki
          </button>
        </nav>
      ) : null}

      <section className="mt-8 rounded-3xl bg-zinc-900 px-5 py-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-8">
        <div>
          <h2 className="text-xl font-semibold">Üretici misiniz?</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
            El emeğinizi Ontic ile pazara taşıyın. Başvuru ve üretim ağı
            hakkında bilgi sayfasını açın.
          </p>
        </div>
        <Link
          href="/uretici-bilgi"
          className="mt-4 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-900 sm:mt-0"
        >
          Bilgi sayfasını aç
        </Link>
      </section>
    </div>
  );
}

function FilterChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium ${
        active
          ? "bg-zinc-900 text-white"
          : "border border-zinc-200 bg-white text-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}
