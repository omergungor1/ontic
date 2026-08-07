import { refreshOrderInternalStatus } from "@/lib/sync";

export const INACTIVE_PRODUCER_ORDER_STATUSES = ["cancelled", "rejected"];

export function isInactiveProducerOrderStatus(status) {
  return INACTIVE_PRODUCER_ORDER_STATUSES.includes(status);
}

/** Üretici siparişini iptal/red eder; atanan adetleri ana siparişe geri bırakır. */
export async function releaseProducerOrder(admin, producerOrder, nextStatus) {
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

  await refreshOrderInternalStatus(producerOrder.trendyol_order_id);
  return { alreadyReleased: false };
}
