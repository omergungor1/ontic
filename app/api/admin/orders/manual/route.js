import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshOrderInternalStatus } from "@/lib/sync";

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const admin = createAdminClient();

    const orderNumber = `MANUAL-${Date.now()}`;
    const lines = body.lines || [];
    if (!lines.length) {
      return NextResponse.json({ error: "En az bir ürün gerekli" }, { status: 400 });
    }

    const gross = lines.reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice || 0),
      0
    );

    const { data: order, error } = await admin
      .from("trendyol_orders")
      .insert({
        order_number: orderNumber,
        status: "Created",
        customer_first_name: body.customerFirstName || "Manuel",
        customer_last_name: body.customerLastName || "Sipariş",
        gross_amount: gross,
        total_price: gross,
        commission_amount: 0,
        net_amount: gross,
        is_manual: true,
        internal_status: "pending_assignment",
        order_date: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    for (const line of lines) {
      await admin.from("trendyol_order_items").insert({
        order_id: order.id,
        product_id: line.productId || null,
        product_name: line.productName || null,
        barcode: line.barcode || null,
        quantity: Number(line.quantity || 1),
        unit_price: Number(line.unitPrice || 0),
        line_total: Number(line.quantity || 1) * Number(line.unitPrice || 0),
        commission_rate: 0,
        assigned_quantity: 0,
      });
    }

    await refreshOrderInternalStatus(order.id);
    return NextResponse.json({ ok: true, id: order.id, orderNumber });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
