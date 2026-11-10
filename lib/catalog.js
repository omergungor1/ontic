import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapVariants(rows) {
  return (rows || []).map((variant, index) => {
    const salePrice = num(variant.sale_price);
    const listPrice = num(variant.list_price);
    // Trendyol'da müşterinin gördüğü fiyat (kampanya dahil); yoksa satıcı satış fiyatı
    const seenByCustomer = num(variant.raw?.price?.priceSeenByCustomer);
    const price = seenByCustomer > 0 ? seenByCustomer : salePrice;
    const struck = Math.max(listPrice, salePrice);
    return {
      label: variant.stock_code || `Seçenek ${index + 1}`,
      price,
      listPrice: struck > price ? struck : price,
    };
  });
}

function bestPrice(variants) {
  const priced = variants.filter((variant) => variant.price > 0);
  const pool = priced.length ? priced : variants;
  return pool.slice().sort((a, b) => a.price - b.price)[0] || null;
}

export function galleryUrls(row) {
  const urls = [];
  if (row.image_url) urls.push(row.image_url);
  const images = Array.isArray(row.images) ? row.images : [];
  for (const image of images) {
    const url = typeof image === "string" ? image : image?.url;
    if (url && !urls.includes(url)) urls.push(url);
    if (urls.length >= 6) break;
  }
  return urls;
}

export const getCatalog = cache(async function getCatalog() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, brand_name, category_name, image_url, content_id, product_variants(sale_price, list_price, raw)"
    )
    .eq("is_active", true)
    .order("title", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const offer = bestPrice(mapVariants(row.product_variants));
    return {
      id: row.id,
      title: row.title || "Ürün",
      brand: row.brand_name || "",
      category: row.category_name || "",
      image: row.image_url || "",
      price: offer?.price || 0,
      listPrice: offer?.listPrice || offer?.price || 0,
      contentId: row.content_id || null,
    };
  });
});

export const getProduct = cache(async function getProduct(id) {
  if (!id) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, description, brand_name, category_name, image_url, images, content_id, is_active, product_variants(stock_code, sale_price, list_price, raw)"
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const variants = mapVariants(data.product_variants);
  return {
    id: data.id,
    title: data.title || "Ürün",
    description: (data.description || "").trim(),
    brand: data.brand_name || "",
    category: data.category_name || "",
    contentId: data.content_id || null,
    images: galleryUrls(data),
    variants: variants.length
      ? variants
      : [{ label: "Standart", price: 0, listPrice: 0 }],
  };
});

export const getSimilarProducts = cache(async function getSimilarProducts(
  product,
  limit = 8
) {
  if (!product?.id) return [];
  const catalog = await getCatalog();
  const others = catalog.filter((item) => item.id !== product.id);
  if (!others.length) return [];

  const category = (product.category || "").trim();
  const brand = (product.brand || "").trim();

  const sameCategory = category
    ? others.filter((item) => item.category === category)
    : [];
  const sameBrand = brand
    ? others.filter(
        (item) => item.brand === brand && item.category !== category
      )
    : [];

  const pickedIds = new Set();
  const result = [];
  for (const item of [...sameCategory, ...sameBrand, ...others]) {
    if (pickedIds.has(item.id)) continue;
    pickedIds.add(item.id);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
});
