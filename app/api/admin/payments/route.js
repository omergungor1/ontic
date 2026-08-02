import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const producerId = searchParams.get("producerId");
    const admin = createAdminClient();

    let paymentsQuery = admin
      .from("payments")
      .select("*, profiles:producer_id(full_name, username)")
      .order("paid_at", { ascending: false });

    if (from) paymentsQuery = paymentsQuery.gte("paid_at", from);
    if (to) paymentsQuery = paymentsQuery.lte("paid_at", to);
    if (producerId) paymentsQuery = paymentsQuery.eq("producer_id", producerId);

    const { data: payments, error } = await paymentsQuery;
    if (error) throw error;

    let ordersQuery = admin
      .from("trendyol_orders")
      .select("id, order_number, net_amount, gross_amount, order_date, internal_status")
      .neq("internal_status", "cancelled")
      .order("order_date", { ascending: false });

    if (from) ordersQuery = ordersQuery.gte("order_date", from);
    if (to) ordersQuery = ordersQuery.lte("order_date", to);

    const { data: orders } = await ordersQuery;

    const income = (orders || []).reduce(
      (sum, row) => sum + Number(row.net_amount || 0),
      0
    );
    const expense = (payments || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    return NextResponse.json({
      payments: payments || [],
      orders: orders || [],
      summary: {
        income,
        expense,
        balance: income - expense,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { user } = await requireAdmin();
    const body = await request.json();
    const admin = createAdminClient();

    const { error } = await admin.from("payments").insert({
      producer_id: body.producerId,
      amount: Number(body.amount),
      note: body.note || null,
      paid_at: body.paidAt || new Date().toISOString(),
      created_by: user.id,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
