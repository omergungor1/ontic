import Link from "next/link";
import ProductCard from "@/components/store/ProductCard";

export default function SimilarProducts({ products, category }) {
  if (!products?.length) return null;

  return (
    <section className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Benzer ürünler
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {category
                ? `${category} kategorisinden öneriler`
                : "Bu ürüne yakın seçenekler"}
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            Tümünü gör
          </Link>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
