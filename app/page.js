import Catalog from "@/components/store/Catalog";
import StoreShell from "@/components/store/StoreShell";
import { getCatalog } from "@/lib/catalog";

export const revalidate = 600;

export const metadata = {
  title: "Ontic | El emeği ürünler",
  description:
    "Ontic el emeği ürünlerini inceleyin. Satın alma WhatsApp veya Trendyol üzerinden tamamlanır.",
};

export default async function HomePage() {
  const products = await getCatalog();
  return (
    <StoreShell>
      <Catalog products={products} />
    </StoreShell>
  );
}
