import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshOrderInternalStatus } from "@/lib/sync";

const MERGEABLE_STATUSES = ["created", "confirmed", "ready"];

export async function POST(request) {
  try {
    const { user } = await requireAdmin();
    const body = await request.json();
    const admin = createAdminClient();

    const orderId = body.orderId;
    const assignments = body.assignments || [];
    // assignments: [{ producerId, items: [{ orderItemId, productId, quantity, unitEarning }] }]

    if (!orderId || !assignments.length) {
      return NextResponse.json(
        { error: "Sipariş ve atama bilgisi gerekli" },
        { status: 400 }
      );
    }

    const { data: orderItems } = await admin
      .from("trendyol_order_items")
      .select("*")
      .eq("order_id", orderId);

    const itemMap = new Map((orderItems || []).map((item) => [item.id, item]));

    for (const assignment of assignments) {
      const validItems = (assignment.items || []).filter(
        (item) => Number(item.quantity) > 0
      );
      if (!validItems.length) continue;

      let earning = 0;
      for (const item of validItems) {
        const orderItem = itemMap.get(item.orderItemId);
        if (!orderItem) {
          throw new Error("Sipariş kalemi bulunamadı");
        }
        const remaining =
          Number(orderItem.quantity) - Number(orderItem.assigned_quantity || 0);
        if (Number(item.quantity) > remaining) {
          throw new Error(
            `${orderItem.product_name || "Ürün"} için kalan adet yetersiz`
          );
        }
        earning += Number(item.quantity) * Number(item.unitEarning || 0);
      }

      // Aynı üreticinin bu siparişteki açık (iptal/kargolanmamış) kaydını bul
      const { data: existingOrder } = await admin
        .from("producer_orders")
        .select("id, producer_earning, status")
        .eq("trendyol_order_id", orderId)
        .eq("producer_id", assignment.producerId)
        .in("status", MERGEABLE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let producerOrderId;

      if (existingOrder) {
        producerOrderId = existingOrder.id;
        await admin
          .from("producer_orders")
          .update({
            producer_earning:
              Number(existingOrder.producer_earning || 0) + earning,
            updated_at: new Date().toISOString(),
          })
          .eq("id", producerOrderId);
      } else {
        const { data: producerOrder, error } = await admin
          .from("producer_orders")
          .insert({
            trendyol_order_id: orderId,
            producer_id: assignment.producerId,
            status: "created",
            producer_earning: earning,
            notes: assignment.notes || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        producerOrderId = producerOrder.id;
      }

      for (const item of validItems) {
        const { data: stockRow } = await admin
          .from("producer_products")
          .select("stock_quantity")
          .eq("producer_id", assignment.producerId)
          .eq("product_id", item.productId)
          .maybeSingle();

        // Aynı sipariş kalemi zaten bu üretici siparişinde varsa miktarı birleştir
        const { data: existingLine } = await admin
          .from("producer_order_items")
          .select("id, quantity, unit_earning")
          .eq("producer_order_id", producerOrderId)
          .eq("order_item_id", item.orderItemId)
          .maybeSingle();

        if (existingLine) {
          await admin
            .from("producer_order_items")
            .update({
              quantity:
                Number(existingLine.quantity || 0) + Number(item.quantity),
              unit_earning:
                Number(item.unitEarning || existingLine.unit_earning || 0),
              stock_at_assignment: Number(stockRow?.stock_quantity || 0),
            })
            .eq("id", existingLine.id);
        } else {
          await admin.from("producer_order_items").insert({
            producer_order_id: producerOrderId,
            order_item_id: item.orderItemId,
            product_id: item.productId || null,
            quantity: Number(item.quantity),
            unit_earning: Number(item.unitEarning || 0),
            stock_at_assignment: Number(stockRow?.stock_quantity || 0),
          });
        }

        const orderItem = itemMap.get(item.orderItemId);
        const newAssigned =
          Number(orderItem.assigned_quantity || 0) + Number(item.quantity);
        await admin
          .from("trendyol_order_items")
          .update({ assigned_quantity: newAssigned })
          .eq("id", item.orderItemId);
        orderItem.assigned_quantity = newAssigned;
      }
    }

    await refreshOrderInternalStatus(orderId);
    return NextResponse.json({ ok: true, by: user.id });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
