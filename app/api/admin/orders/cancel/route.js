import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseProducerOrder } from "@/lib/producer-orders";
import { refreshOrderInternalStatus } from "@/lib/sync";

export async function POST(request) {
  try {
    await requireAdmin();
    const { orderId, action } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: "Sipariş gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: order, error } = await admin
      .from("trendyol_orders")
      .select("id, internal_status")
      .eq("id", orderId)
      .single();
    if (error) throw error;
    if (!order) {
      return NextResponse.json({ error: "Sipariş yok" }, { status: 404 });
    }

    if (action === "restore") {
      if (order.internal_status !== "cancelled") {
        return NextResponse.json({ ok: true });
      }
      // refresh, cancelled ise erken çıkar — önce geçici durum yaz
      await admin
        .from("trendyol_orders")
        .update({
          internal_status: "pending_assignment",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      await refreshOrderInternalStatus(orderId);
      return NextResponse.json({ ok: true });
    }

    // cancel
    const { data: producerOrders } = await admin
      .from("producer_orders")
      .select("*, producer_order_items(*)")
      .eq("trendyol_order_id", orderId);

    for (const po of producerOrders || []) {
      await releaseProducerOrder(admin, po, "cancelled", {
        skipRefresh: true,
      });
    }

    await admin
      .from("trendyol_orders")
      .update({
        internal_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
