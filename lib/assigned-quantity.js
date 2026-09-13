export const INACTIVE_PRODUCER_ORDER_STATUSES = ["cancelled", "rejected"];

export function isInactiveProducerOrderStatus(status) {
  return INACTIVE_PRODUCER_ORDER_STATUSES.includes(status);
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function trendyolStatusTokens(order) {
  return [order?.status, order?.shipment_package_status]
    .map(normalizeStatus)
    .filter(Boolean);
}

const TRENDYOL_CANCELLED = new Set([
  "cancelled",
  "canceled",
  "undelivered",
  "returned",
  "unsupplied",
]);

export function isTrendyolCancelled(order) {
  return trendyolStatusTokens(order).some(
    (status) => TRENDYOL_CANCELLED.has(status) || status.includes("cancel")
  );
}

export function isTrendyolDelivered(order) {
  if (isTrendyolCancelled(order)) return false;
  return trendyolStatusTokens(order).some((status) => status === "delivered");
}

function remainingOf(item, assigned) {
  return Math.max(0, Number(item.quantity || 0) - Number(assigned[item.id] || 0));
}

function matchItemForLine(items, assigned, line) {
  const itemById = new Map((items || []).map((item) => [item.id, item]));
  if (line.order_item_id && itemById.has(line.order_item_id)) {
    return itemById.get(line.order_item_id);
  }

  const byProduct = (items || []).filter(
    (item) => line.product_id && item.product_id === line.product_id
  );
  const pool = (byProduct.length ? byProduct : items || []).slice();
  pool.sort((a, b) => remainingOf(b, assigned) - remainingOf(a, assigned));
  return pool.find((item) => remainingOf(item, assigned) > 0) || pool[0] || null;
}

/** Aktif üretici siparişlerinden kalem bazlı dağıtılan adet. */
export function computeAssignedByItemId(items, producerOrders) {
  const assigned = {};
  for (const item of items || []) assigned[item.id] = 0;

  for (const po of producerOrders || []) {
    if (isInactiveProducerOrderStatus(po.status)) continue;
    for (const line of po.producer_order_items || []) {
      const qty = Number(line.quantity || 0);
      if (qty <= 0) continue;
      const item = matchItemForLine(items, assigned, line);
      if (!item) continue;
      assigned[item.id] += qty;
    }
  }

  return assigned;
}

export function remainingByItemId(items, producerOrders) {
  const assigned = computeAssignedByItemId(items, producerOrders);
  const remaining = {};
  for (const item of items || []) {
    remaining[item.id] = remainingOf(item, assigned);
  }
  return remaining;
}

export function deriveInternalStatus(order, items, producerOrders) {
  if (!order) return "pending_assignment";
  if (order.internal_status === "cancelled" || isTrendyolCancelled(order)) {
    return "cancelled";
  }

  const assignedMap = computeAssignedByItemId(items, producerOrders);
  const total = (items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
  const assigned = (items || []).reduce(
    (sum, item) => sum + Number(assignedMap[item.id] || 0),
    0
  );

  const active = (producerOrders || []).filter(
    (row) => !isInactiveProducerOrderStatus(row.status)
  );
  if (
    active.length &&
    active.every((row) => ["shipped", "completed"].includes(row.status))
  ) {
    return "completed";
  }

  if (isTrendyolDelivered(order)) return "completed";

  if (assigned <= 0) return "pending_assignment";
  if (total > 0 && assigned < total) return "partially_assigned";
  if (total > 0 && assigned >= total) return "assigned";
  return "pending_assignment";
}

/** Sync sonrası kopan order_item_id bağlarını onarır, assigned_quantity'yi canlı atamalardan yazar. */
export async function reconcileAssignedQuantities(admin, orderId) {
  const { data: items, error: itemsError } = await admin
    .from("trendyol_order_items")
    .select("id, product_id, barcode, quantity, assigned_quantity")
    .eq("order_id", orderId);
  if (itemsError) throw itemsError;

  const { data: producerOrders, error: poError } = await admin
    .from("producer_orders")
    .select(
      "id, status, producer_order_items(id, order_item_id, product_id, quantity)"
    )
    .eq("trendyol_order_id", orderId);
  if (poError) throw poError;

  const itemIds = new Set((items || []).map((item) => item.id));
  const assigned = {};
  for (const item of items || []) assigned[item.id] = 0;

  for (const po of producerOrders || []) {
    if (isInactiveProducerOrderStatus(po.status)) continue;
    for (const line of po.producer_order_items || []) {
      if (line.order_item_id && itemIds.has(line.order_item_id)) {
        assigned[line.order_item_id] += Number(line.quantity || 0);
      }
    }
  }

  for (const po of producerOrders || []) {
    for (const line of po.producer_order_items || []) {
      if (line.order_item_id && itemIds.has(line.order_item_id)) continue;
      const target = matchItemForLine(items, assigned, line);
      if (!target) continue;
      const { error } = await admin
        .from("producer_order_items")
        .update({ order_item_id: target.id })
        .eq("id", line.id);
      if (error) throw error;
      line.order_item_id = target.id;
      if (!isInactiveProducerOrderStatus(po.status)) {
        assigned[target.id] += Number(line.quantity || 0);
      }
    }
  }

  for (const item of items || []) {
    const qty = Number(assigned[item.id] || 0);
    if (Number(item.assigned_quantity || 0) !== qty) {
      const { error } = await admin
        .from("trendyol_order_items")
        .update({ assigned_quantity: qty })
        .eq("id", item.id);
      if (error) throw error;
      item.assigned_quantity = qty;
    }
  }

  return { items: items || [], assigned };
}
