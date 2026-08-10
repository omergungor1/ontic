import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateOrdersNetProfit,
  getStoreFinancialSettings,
  roundMoney,
} from "@/lib/net-profit";

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

    let producerOrdersQuery = admin
      .from("producer_orders")
      .select(
        "id, producer_id, producer_earning, status, created_at, trendyol_order_id, trendyol_orders!trendyol_order_id(order_number), profiles:producer_id(full_name, username)"
      )
      .not("status", "in", '("cancelled","rejected")')
      .order("created_at", { ascending: false });

    if (from) producerOrdersQuery = producerOrdersQuery.gte("created_at", from);
    if (to) producerOrdersQuery = producerOrdersQuery.lte("created_at", to);
    if (producerId) {
      producerOrdersQuery = producerOrdersQuery.eq("producer_id", producerId);
    }

    const { data: producerOrders, error: poError } = await producerOrdersQuery;
    if (poError) throw poError;

    let orders = [];
    if (producerId) {
      const orderIds = [
        ...new Set(
          (producerOrders || [])
            .map((po) => po.trendyol_order_id)
            .filter(Boolean)
        ),
      ];
      if (orderIds.length) {
        const { data } = await admin
          .from("trendyol_orders")
          .select(
            "id, order_number, net_amount, gross_amount, total_price, commission_amount, order_date, internal_status, customer_first_name, customer_last_name"
          )
          .in("id", orderIds)
          .neq("internal_status", "cancelled")
          .order("order_date", { ascending: false });
        orders = data || [];
      }
    } else {
      let ordersQuery = admin
        .from("trendyol_orders")
        .select(
          "id, order_number, net_amount, gross_amount, total_price, commission_amount, order_date, internal_status, customer_first_name, customer_last_name"
        )
        .neq("internal_status", "cancelled")
        .order("order_date", { ascending: false });
      if (from) ordersQuery = ordersQuery.gte("order_date", from);
      if (to) ordersQuery = ordersQuery.lte("order_date", to);
      const { data } = await ordersQuery;
      orders = data || [];
    }

    const settings = await getStoreFinancialSettings(admin);
    const profitRows = await calculateOrdersNetProfit(
      admin,
      orders.map((o) => o.id),
      settings
    );
    const profitById = new Map(profitRows.map((row) => [row.orderId, row]));

    const ordersWithProfit = orders.map((order) => ({
      ...order,
      profit: profitById.get(order.id) || null,
    }));

    const income = orders.reduce(
      (sum, row) => sum + Number(row.net_amount || 0),
      0
    );
    const expense = (payments || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );
    const producerEarnings = (producerOrders || []).reduce(
      (sum, row) => sum + Number(row.producer_earning || 0),
      0
    );
    const netProfit = roundMoney(
      profitRows.reduce((sum, row) => sum + Number(row.netProfit || 0), 0)
    );

    return NextResponse.json({
      payments: payments || [],
      producerOrders: producerOrders || [],
      orders: ordersWithProfit,
      settings,
      summary: {
        income: roundMoney(income),
        expense: roundMoney(expense),
        producerEarnings: roundMoney(producerEarnings),
        balance: roundMoney(income - expense),
        netProfit,
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
