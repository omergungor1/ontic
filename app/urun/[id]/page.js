import { notFound } from "next/navigation";
import ProductBuy from "@/components/store/ProductBuy";
import SimilarProducts from "@/components/store/SimilarProducts";
import StoreShell from "@/components/store/StoreShell";
import { getProduct, getSimilarProducts } from "@/lib/catalog";

export const revalidate = 600;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: "Ürün bulunamadı | Ontic" };
  return {
    title: `${product.title} | Ontic`,
    description: (product.description || product.title).slice(0, 160),
  };
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const similar = await getSimilarProducts(product, 8);

  return (
    <StoreShell>
      <ProductBuy product={product} />
      <SimilarProducts products={similar} category={product.category} />
    </StoreShell>
  );
}
