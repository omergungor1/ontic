import Link from "next/link";
import StorageImage from "@/components/StorageImage";
import { formatPrice } from "@/lib/format";
import { storeImage } from "@/lib/storefront";

function discountPercent(price, listPrice) {
  if (!(price > 0) || !(listPrice > price)) return 0;
  return Math.round(((listPrice - price) / listPrice) * 100);
}

export default function ProductCard({ product }) {
  const discount = discountPercent(product.price, product.listPrice);

  return (
    <Link
      href={`/urun/${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-orange-200 hover:shadow-md"
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
        {discount > 0 ? (
          <span className="absolute left-2 top-2 rounded-full bg-orange-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            %{discount}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {product.category || product.brand || "Ontic"}
        </p>
        <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 group-hover:text-orange-800">
          {product.title}
        </h2>
        <div className="mt-auto pt-3">
          {discount > 0 ? (
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
  );
}
