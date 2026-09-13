import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrders, fetchProducts } from "@/lib/trendyol";
import {
  deriveInternalStatus,
  isTrendyolCancelled,
  isTrendyolDelivered,
  reconcileAssignedQuantities,
} from "@/lib/assigned-quantity";

function firstImage(images = []) {
  return images?.[0]?.url || null;
}

function calcLineCommission(line) {
  const rate = Number(line.commission || 0);
  const total = Number(line.lineGrossAmount ?? line.amount ?? line.price ?? 0);
  return (total * rate) / 100;
}

export async function syncProductsFromTrendyol() {
  const result = await fetchProducts({ all: true, size: 100 });
  if (!result.ok) {
    throw new Error(
      result.data?.message || result.data?.exception || "Ürün sync başarısız"
    );
  }

  const admin = createAdminClient();
  const content = result.data?.content || [];
  const seenContentIds = [];

  for (const item of content) {
    seenContentIds.push(item.contentId);

    const productPayload = {
      content_id: item.contentId,
      product_main_id: item.productMainId || null,
      title: item.title || "İsimsiz ürün",
      description: item.description || null,
      brand_id: item.brand?.id || null,
      brand_name: item.brand?.name || null,
      category_id: item.category?.id || null,
      category_name: item.category?.name || null,
      image_url: firstImage(item.images),
      images: item.images || [],
      attributes: item.attributes || [],
      is_active: true,
      is_manual: false,
      trendyol_last_modified: item.lastModifiedDate || null,
      raw: item,
      updated_at: new Date().toISOString(),
    };

    const { data: product, error } = await admin
      .from("products")
      .upsert(productPayload, { onConflict: "content_id" })
      .select("id")
      .single();

    if (error) throw error;

    const variants = item.variants || [];
    for (const variant of variants) {
      if (!variant.barcode) continue;
      const { error: variantError } = await admin.from("product_variants").upsert(
        {
          product_id: product.id,
          variant_id: variant.variantId || null,
          barcode: variant.barcode,
          stock_code: variant.stockCode || null,
          sale_price: variant.price?.salePrice ?? 0,
          list_price: variant.price?.listPrice ?? 0,
          quantity: variant.stock?.quantity ?? 0,
          commission: variant.commission ?? 0,
          on_sale: Boolean(variant.onSale),
          blacklisted: Boolean(variant.blacklisted),
          archived: Boolean(variant.archived),
          vat_rate: variant.vatRate ?? 0,
          raw: variant,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "barcode" }
      );
      if (variantError) throw variantError;
    }
  }

  // Sync'te gelmeyen trendyol ürünlerini pasife çek (manuel olanlara dokunma)
  if (seenContentIds.length > 0) {
    const { data: existing } = await admin
      .from("products")
      .select("id, content_id")
      .eq("is_manual", false)
      .not("content_id", "is", null);

    const missingIds = (existing || [])
      .filter((row) => !seenContentIds.includes(row.content_id))
      .map((row) => row.id);

    if (missingIds.length > 0) {
      await admin
        .from("products")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", missingIds);
    }
  }

  return { synced: content.length };
}

export async function syncOrdersFromTrendyol({ days = 30 } = {}) {
  const result = await fetchOrders({ days, all: true, size: 200 });
  if (!result.ok) {
    throw new Error(
      result.data?.message || result.data?.exception || "Sipariş sync başarısız"
    );
  }

  const admin = createAdminClient();
  const content = result.data?.content || [];
  let synced = 0;
  const syncedIds = new Set();

  for (const order of content) {
    const lines = order.lines || [];
    const commissionAmount = lines.reduce(
      (sum, line) => sum + calcLineCommission(line),
      0
    );
    const gross = Number(order.grossAmount ?? order.totalPrice ?? 0);
    const net = gross - commissionAmount;

    const orderPayload = {
      trendyol_package_id: order.id || order.shipmentPackageId,
      order_number: String(order.orderNumber),
      status: order.status || null,
      shipment_package_status: order.shipmentPackageStatus || null,
      customer_first_name: order.customerFirstName || null,
      customer_last_name: order.customerLastName || null,
      customer_email: order.customerEmail || null,
      gross_amount: gross,
      total_price: Number(order.totalPrice ?? gross),
      commission_amount: Number(commissionAmount.toFixed(2)),
      net_amount: Number(net.toFixed(2)),
      cargo_provider_name: order.cargoProviderName || null,
      cargo_tracking_number: order.cargoTrackingNumber
        ? String(order.cargoTrackingNumber)
        : null,
      cargo_tracking_link: order.cargoTrackingLink || null,
      shipment_address: order.shipmentAddress || null,
      invoice_address: order.invoiceAddress || null,
      order_date: order.orderDate ? new Date(order.orderDate).toISOString() : null,
      last_modified_date: order.lastModifiedDate
        ? new Date(order.lastModifiedDate).toISOString()
        : null,
      is_manual: false,
      raw: order,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await admin
      .from("trendyol_orders")
      .select("id, internal_status")
      .eq("trendyol_package_id", orderPayload.trendyol_package_id)
      .maybeSingle();

    let orderId;

    if (existing) {
      const { data: updated, error } = await admin
        .from("trendyol_orders")
        .update({
          ...orderPayload,
          // iptal/tamamlandı durumunu koru
          internal_status: existing.internal_status,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      orderId = updated.id;

    } else {
      const { data: inserted, error } = await admin
        .from("trendyol_orders")
        .insert(orderPayload)
        .select("id")
        .single();
      if (error) throw error;
      orderId = inserted.id;
    }

    const keepIds = await upsertTrendyolOrderItems(admin, orderId, lines);
    await refreshOrderInternalStatus(orderId);
    await pruneUnreferencedOrderItems(admin, orderId, keepIds);
    syncedIds.add(orderId);
    synced += 1;
  }

  await repairStaleInternalStatuses(admin, syncedIds);
  return { synced, days };
}

async function resolveProductId(admin, line) {
  if (line.barcode) {
    const { data: variant } = await admin
      .from("product_variants")
      .select("product_id")
      .eq("barcode", line.barcode)
      .maybeSingle();
    if (variant?.product_id) return variant.product_id;
  }
  if (line.contentId) {
    const { data: product } = await admin
      .from("products")
      .select("id")
      .eq("content_id", line.contentId)
      .maybeSingle();
    if (product?.id) return product.id;
  }
  return null;
}

async function upsertTrendyolOrderItems(admin, orderId, lines) {
  const { data: existingItems, error: existingError } = await admin
    .from("trendyol_order_items")
    .select("id, line_id, barcode, product_id")
    .eq("order_id", orderId);
  if (existingError) throw existingError;

  const remaining = [...(existingItems || [])];
  const keepIds = new Set();

  function takeMatch(predicate) {
    const index = remaining.findIndex(predicate);
    if (index < 0) return null;
    return remaining.splice(index, 1)[0];
  }

  for (const line of lines) {
    const productId = await resolveProductId(admin, line);
    const lineId = line.lineId || line.id || null;
    const barcode = line.barcode || null;

    const existing =
      (lineId != null
        ? takeMatch((item) => String(item.line_id || "") === String(lineId))
        : null) ||
      (barcode ? takeMatch((item) => item.barcode === barcode) : null) ||
      (productId
        ? takeMatch((item) => item.product_id === productId)
        : null) ||
      (remaining.length === 1 && lines.length === 1 ? remaining.shift() : null);

    const payload = {
      order_id: orderId,
      line_id: lineId,
      barcode,
      product_id: productId,
      product_name: line.productName || null,
      quantity: line.quantity || 1,
      unit_price: line.price ?? line.lineUnitPrice ?? 0,
      line_total: line.lineGrossAmount ?? line.amount ?? line.price ?? 0,
      commission_rate: line.commission ?? 0,
    };

    if (existing) {
      const { error } = await admin
        .from("trendyol_order_items")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
      keepIds.add(existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("trendyol_order_items")
        .insert({
          ...payload,
          assigned_quantity: 0,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (inserted?.id) keepIds.add(inserted.id);
    }
  }

  return keepIds;
}

async function pruneUnreferencedOrderItems(admin, orderId, keepIds) {
  const { data: items } = await admin
    .from("trendyol_order_items")
    .select("id")
    .eq("order_id", orderId);

  for (const item of items || []) {
    if (keepIds?.has(item.id)) continue;
    const { data: refs } = await admin
      .from("producer_order_items")
      .select("id")
      .eq("order_item_id", item.id)
      .limit(1);
    if (refs?.length) continue;
    await admin.from("trendyol_order_items").delete().eq("id", item.id);
  }
}

async function repairStaleInternalStatuses(admin, syncedIds = new Set()) {
  const { data: orders } = await admin
    .from("trendyol_orders")
    .select("id, status, shipment_package_status, internal_status")
    .order("order_date", { ascending: false })
    .limit(500);

  for (const order of orders || []) {
    if (syncedIds.has(order.id)) continue;
    const needsRepair =
      ["pending_assignment", "partially_assigned"].includes(
        order.internal_status
      ) ||
      (isTrendyolCancelled(order) && order.internal_status !== "cancelled") ||
      (isTrendyolDelivered(order) && order.internal_status !== "completed");
    if (!needsRepair) continue;
    await refreshOrderInternalStatus(order.id);
  }
}

export async function refreshOrderInternalStatus(orderId) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("trendyol_orders")
    .select("id, internal_status, status, shipment_package_status")
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const { items } = await reconcileAssignedQuantities(admin, orderId);
  const { data: producerOrders } = await admin
    .from("producer_orders")
    .select(
      "status, producer_order_items(order_item_id, product_id, quantity)"
    )
    .eq("trendyol_order_id", orderId);

  const internalStatus = deriveInternalStatus(order, items, producerOrders);

  if (order.internal_status !== internalStatus) {
    await admin
      .from("trendyol_orders")
      .update({
        internal_status: internalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  }

  return internalStatus;
}
