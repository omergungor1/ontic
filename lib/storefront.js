export const STORE_WHATSAPP = "905425861590";
export const TRENDYOL_STORE = "https://www.trendyol.com/magaza/m-m-198608";
export const PAGE_SIZE = 12;

export function storeImage(url, size = 480) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "cdn.dsmcdn.com") return url;
    if (parsed.pathname.includes("/mnresize/")) return url;
    const width = Math.min(Math.max(Number(size) || 480, 200), 1200);
    return `https://cdn.dsmcdn.com/mnresize/${width}/${width}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function trendyolHref(contentId, title) {
  if (contentId) {
    return `https://www.trendyol.com/ontic/urun-p-${contentId}`;
  }
  const query = encodeURIComponent(title || "ontic");
  return `https://www.trendyol.com/sr?mid=198608&q=${query}`;
}

export function whatsappHref({
  title,
  quantity,
  variantLabel,
  unitLabel,
  totalLabel,
}) {
  const lines = [
    "Merhaba Ontic, sipariş vermek istiyorum.",
    "",
    `Ürün: ${title}`,
  ];
  if (variantLabel) lines.push(`Seçenek: ${variantLabel}`);
  lines.push(`Adet: ${quantity}`);
  if (unitLabel) lines.push(`Birim fiyat: ${unitLabel}`);
  if (totalLabel) lines.push(`Toplam: ${totalLabel}`);
  lines.push("", "Ödemeyi ve teslimatı bu mesajdan netleştirelim.");
  return `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
}
