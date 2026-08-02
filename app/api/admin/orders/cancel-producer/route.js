import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshOrderInternalStatus } from "@/lib/sync";

export async function POST(request) {
  try {
    await requireAdmin();
    const { producerOrderId } = await request.json();
    const admin = createAdminClient();

    const { data: producerOrder, error } = await admin
      .from("producer_orders")
      .select("*, producer_order_items(*)")
      .eq("id", producerOrderId)
      .single();
    if (error) throw error;

    if (producerOrder.status === "cancelled") {
      return NextResponse.json({ ok: true });
    }

    await admin
      .from("producer_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", producerOrderId);

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
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
