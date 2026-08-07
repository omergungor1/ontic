import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseProducerOrder } from "@/lib/producer-orders";

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

    await releaseProducerOrder(admin, producerOrder, "cancelled");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
