import { syncProducerCampaignClaims } from "@/lib/campaigns";
import { applyStarBonusForStockChange } from "@/lib/star-bonus";

/**
 * Stok değişimini loglar.
 * source:
 *  - manual: üreticinin kendi güncellemesi (kampanyaya sayılır)
 *  - shipment: kargo düşümü (kampanyaya sayılmaz)
 *  - admin: admin ataması/güncellemesi (kampanyaya sayılmaz)
 *  - restore: iptal sonrası stok iadesi (kampanyaya sayılmaz)
 */
export async function logStockChange(
  admin,
  {
    producerId,
    productId = null,
    producerProductId = null,
    previousQuantity,
    newQuantity,
    source,
    createdBy = null,
    syncCampaigns = true,
  }
) {
  const prev = Math.max(0, Number(previousQuantity || 0));
  const next = Math.max(0, Number(newQuantity || 0));
  const delta = next - prev;
  if (!producerId || !source || delta === 0) return null;

  const { data, error } = await admin
    .from("stock_change_logs")
    .insert({
      producer_id: producerId,
      product_id: productId || null,
      producer_product_id: producerProductId || null,
      previous_quantity: prev,
      new_quantity: next,
      delta,
      source,
      created_by: createdBy || null,
    })
    .select("id, delta, source, created_at")
    .single();
  if (error) throw error;

  if (syncCampaigns && source === "manual") {
    await syncProducerCampaignClaims(admin, producerId);
  }

  const starBonus = await applyStarBonusForStockChange(admin, {
    producerId,
    productId,
    producerProductId,
    delta,
    source,
    stockChangeLogId: data.id,
  });

  return { ...data, starBonusAmount: Number(starBonus.amount || 0) };
}

export async function updateProducerProductStock(
  admin,
  {
    producerProductId,
    producerId,
    productId = null,
    newQuantity,
    source,
    createdBy = null,
  }
) {
  const { data: row, error: findError } = await admin
    .from("producer_products")
    .select("id, producer_id, product_id, stock_quantity")
    .eq("id", producerProductId)
    .maybeSingle();
  if (findError) throw findError;
  if (!row) throw new Error("Üretici ürünü bulunamadı");

  const prev = Number(row.stock_quantity || 0);
  const next = Math.max(0, Number(newQuantity || 0));
  if (prev === next) {
    return { row, changed: false, delta: 0 };
  }

  const { error: updateError } = await admin
    .from("producer_products")
    .update({
      stock_quantity: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (updateError) throw updateError;

  const log = await logStockChange(admin, {
    producerId: producerId || row.producer_id,
    productId: productId || row.product_id,
    producerProductId: row.id,
    previousQuantity: prev,
    newQuantity: next,
    source,
    createdBy,
  });

  return {
    row,
    changed: true,
    delta: next - prev,
    previousQuantity: prev,
    newQuantity: next,
    starBonusAmount: Number(log?.starBonusAmount || 0),
  };
}
