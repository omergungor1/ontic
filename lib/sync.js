import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrders, fetchProducts } from "@/lib/trendyol";

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

      await admin.from("trendyol_order_items").delete().eq("order_id", orderId);
    } else {
      const { data: inserted, error } = await admin
        .from("trendyol_orders")
        .insert(orderPayload)
        .select("id")
        .single();
      if (error) throw error;
      orderId = inserted.id;
    }

    for (const line of lines) {
      let productId = null;
      if (line.barcode) {
        const { data: variant } = await admin
          .from("product_variants")
          .select("product_id")
          .eq("barcode", line.barcode)
          .maybeSingle();
        productId = variant?.product_id || null;
      }
      if (!productId && line.contentId) {
        const { data: product } = await admin
          .from("products")
          .select("id")
          .eq("content_id", line.contentId)
          .maybeSingle();
        productId = product?.id || null;
      }

      const { error: itemError } = await admin.from("trendyol_order_items").insert({
        order_id: orderId,
        line_id: line.lineId || line.id || null,
        barcode: line.barcode || null,
        product_id: productId,
        product_name: line.productName || null,
        quantity: line.quantity || 1,
        unit_price: line.price ?? line.lineUnitPrice ?? 0,
        line_total: line.lineGrossAmount ?? line.amount ?? line.price ?? 0,
        commission_rate: line.commission ?? 0,
        assigned_quantity: 0,
      });
      if (itemError) throw itemError;
    }

    // Mevcut atamaları yansıt
    const { data: items } = await admin
      .from("trendyol_order_items")
      .select("id")
      .eq("order_id", orderId);

    for (const item of items || []) {
      const { data: assigned } = await admin
        .from("producer_order_items")
        .select("quantity, producer_orders!inner(status)")
        .eq("order_item_id", item.id)
        .neq("producer_orders.status", "cancelled");

      const assignedQty = (assigned || []).reduce(
        (sum, row) => sum + Number(row.quantity || 0),
        0
      );

      await admin
        .from("trendyol_order_items")
        .update({ assigned_quantity: assignedQty })
        .eq("id", item.id);
    }

    await refreshOrderInternalStatus(orderId);
    synced += 1;
  }

  return { synced, days };
}

export async function refreshOrderInternalStatus(orderId) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("trendyol_orders")
    .select("id, internal_status")
    .eq("id", orderId)
    .single();

  if (!order || order.internal_status === "cancelled") return;

  const { data: items } = await admin
    .from("trendyol_order_items")
    .select("quantity, assigned_quantity")
    .eq("order_id", orderId);

  if (!items?.length) return;

  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const assigned = items.reduce(
    (sum, item) => sum + Number(item.assigned_quantity || 0),
    0
  );

  let internalStatus = "pending_assignment";
  if (assigned <= 0) internalStatus = "pending_assignment";
  else if (assigned < total) internalStatus = "partially_assigned";
  else internalStatus = "assigned";

  const { data: producerOrders } = await admin
    .from("producer_orders")
    .select("status")
    .eq("trendyol_order_id", orderId)
    .neq("status", "cancelled");

  if (
    producerOrders?.length &&
    producerOrders.every((row) =>
      ["shipped", "completed"].includes(row.status)
    )
  ) {
    internalStatus = "completed";
  }

  await admin
    .from("trendyol_orders")
    .update({
      internal_status: internalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}
