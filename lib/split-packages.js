export const SPLIT_CANCEL_REASON =
  "Trendyol gönderi paketi bölündüğü için otomatik iptal edildi.";

const OPEN_PRODUCER_STATUSES = ["created", "confirmed", "ready"];

export function packageIdOf(order) {
  const id = order?.shipmentPackageId ?? order?.id ?? order?.trendyol_package_id;
  if (id == null || id === "") return "";
  return String(id);
}

export function orderNumberOf(order) {
  const value = order?.orderNumber ?? order?.order_number;
  if (value == null || value === "") return "";
  return String(value);
}

export function originPackageIdsOf(order) {
  const raw = order?.originPackageIds ?? order?.origin_package_ids;
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((id) => (id == null ? "" : String(id).trim()))
        .filter(Boolean)
    ),
  ];
}

/** Gelen paketlerden, bölünerek yerine yenisi geçen paketleri çıkarır. */
export function planSplitCancellations(packages) {
  const grouped = new Map();

  for (const pkg of packages || []) {
    const childId = packageIdOf(pkg);
    const orderNumber = orderNumberOf(pkg);
    for (const originId of originPackageIdsOf(pkg)) {
      if (!originId || originId === childId) continue;
      if (!grouped.has(originId)) {
        grouped.set(originId, {
          replacedBy: new Set(),
          orderNumbers: new Set(),
        });
      }
      const entry = grouped.get(originId);
      if (childId) entry.replacedBy.add(childId);
      if (orderNumber) entry.orderNumbers.add(orderNumber);
    }
  }

  return [...grouped.entries()].map(([packageId, entry]) => ({
    packageId,
    replacedByPackageIds: [...entry.replacedBy],
    orderNumbers: [...entry.orderNumbers],
  }));
}

function sameOrder(parentNumber, childNumbers) {
  if (!parentNumber || !childNumbers.length) return true;
  return childNumbers.includes(String(parentNumber));
}

async function fetchOrdersByPackageIds(admin, packageIds) {
  const rows = [];
  const ids = [...new Set(packageIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 150) {
    const slice = ids.slice(i, i + 150).map((id) => (/^\d+$/.test(id) ? Number(id) : id));
    const { data, error } = await admin
      .from("trendyol_orders")
      .select("id, trendyol_package_id, order_number, internal_status")
      .in("trendyol_package_id", slice);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

export async function applySplitCancellations(admin, packages, deps = {}) {
  const releaseProducerOrder =
    deps.releaseProducerOrder ||
    (await import("@/lib/producer-orders")).releaseProducerOrder;
  const plan = planSplitCancellations(packages);
  const result = { cancelled: [], skipped: [] };
  if (!plan.length) return result;

  const rows = await fetchOrdersByPackageIds(
    admin,
    plan.map((item) => item.packageId)
  );
  const byPackage = new Map(
    rows.map((row) => [String(row.trendyol_package_id), row])
  );

  for (const item of plan) {
    const row = byPackage.get(item.packageId);
    if (!row) {
      result.skipped.push({ packageId: item.packageId, reason: "missing" });
      continue;
    }
    if (!sameOrder(row.order_number, item.orderNumbers)) {
      result.skipped.push({ packageId: item.packageId, reason: "order-mismatch" });
      continue;
    }
    if (row.internal_status === "cancelled") {
      result.skipped.push({ packageId: item.packageId, reason: "already-cancelled" });
      continue;
    }
    if (row.internal_status === "completed") {
      result.skipped.push({ packageId: item.packageId, reason: "completed" });
      continue;
    }

    const { data: producerOrders, error: producerError } = await admin
      .from("producer_orders")
      .select("*, producer_order_items(*)")
      .eq("trendyol_order_id", row.id);
    if (producerError) throw producerError;

    for (const producerOrder of producerOrders || []) {
      if (!OPEN_PRODUCER_STATUSES.includes(producerOrder.status)) continue;
      await releaseProducerOrder(admin, producerOrder, "cancelled", {
        skipRefresh: true,
      });
    }

    const replacedBy = item.replacedByPackageIds.map((id) =>
      /^\d+$/.test(id) ? Number(id) : id
    );
    const { data: updated, error } = await admin
      .from("trendyol_orders")
      .update({
        internal_status: "cancelled",
        cancel_reason: SPLIT_CANCEL_REASON,
        replaced_by_package_ids: replacedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .neq("internal_status", "cancelled")
      .select("id");
    if (error) throw error;
    if (!updated?.length) {
      result.skipped.push({ packageId: item.packageId, reason: "already-cancelled" });
      continue;
    }

    row.internal_status = "cancelled";
    result.cancelled.push({
      packageId: item.packageId,
      orderId: row.id,
      replacedByPackageIds: item.replacedByPackageIds,
    });
    console.info(
      `[trendyol-sync] bölünen paket iptal edildi ${item.packageId} -> ${item.replacedByPackageIds.join(",")}`
    );
  }

  return result;
}
