import { refreshOrderInternalStatus } from "@/lib/sync";

export const INACTIVE_PRODUCER_ORDER_STATUSES = ["cancelled", "rejected"];

export function isInactiveProducerOrderStatus(status) {
  return INACTIVE_PRODUCER_ORDER_STATUSES.includes(status);
}

/** Üretici siparişini iptal/red eder; atanan adetleri ana siparişe geri bırakır. */
export async function releaseProducerOrder(
  admin,
  producerOrder,
  nextStatus,
  { skipRefresh = false } = {}
) {
  if (!["cancelled", "rejected"].includes(nextStatus)) {
    throw new Error("Geçersiz durum");
  }

  if (isInactiveProducerOrderStatus(producerOrder.status)) {
    return { alreadyReleased: true };
  }

  await admin
    .from("producer_orders")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", producerOrder.id);

  for (const item of producerOrder.producer_order_items || []) {
    if (!item.order_item_id) continue;
    const { data: orderItem } = await admin
      .from("trendyol_order_items")
      .select("assigned_quantity")
      .eq("id", item.order_item_id)
      .single();

    const nextAssigned = Math.max(
      0,
      Number(orderItem?.assigned_quantity || 0) - Number(item.quantity || 0)
    );

    await admin
      .from("trendyol_order_items")
      .update({ assigned_quantity: nextAssigned })
      .eq("id", item.order_item_id);
  }

  if (!skipRefresh) {
    await refreshOrderInternalStatus(producerOrder.trendyol_order_id);
  }
  return { alreadyReleased: false };
}

/** Üretici kargoladığında ilgili ürün stoklarından sipariş adedi kadar düşer (min 0). */
export async function deductProducerStockOnShip(admin, producerOrder) {
  const producerId = producerOrder.producer_id;
  if (!producerId) return;

  for (const item of producerOrder.producer_order_items || []) {
    if (!item.product_id) continue;
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;

    const { data: row } = await admin
      .from("producer_products")
      .select("id, stock_quantity")
      .eq("producer_id", producerId)
      .eq("product_id", item.product_id)
      .maybeSingle();

    if (!row) continue;

    const nextStock = Math.max(0, Number(row.stock_quantity || 0) - qty);
    await admin
      .from("producer_products")
      .update({
        stock_quantity: nextStock,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}
