import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateOrdersNetProfit,
  getStoreFinancialSettings,
  roundMoney,
} from "@/lib/net-profit";
import { PAYABLE_PRODUCER_ORDER_STATUSES } from "@/lib/producer-orders";

const DATE_FIELDS = new Set(["shipped_at", "order_date"]);

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const producerId = searchParams.get("producerId");
    const dateFieldRaw = searchParams.get("dateField") || "shipped_at";
    const dateField = DATE_FIELDS.has(dateFieldRaw)
      ? dateFieldRaw
      : "shipped_at";
    const admin = createAdminClient();

    // Ödemeler her zaman ödeme tarihine göre
    let paymentsQuery = admin
      .from("payments")
      .select("*, profiles:producer_id(full_name, username)")
      .order("paid_at", { ascending: false });

    if (from) paymentsQuery = paymentsQuery.gte("paid_at", from);
    if (to) paymentsQuery = paymentsQuery.lte("paid_at", to);
    if (producerId) paymentsQuery = paymentsQuery.eq("producer_id", producerId);

    const { data: payments, error } = await paymentsQuery;
    if (error) throw error;

    let producerOrders = [];
    let orders = [];

    if (dateField === "order_date") {
      // Trendyol sipariş tarihine göre
      let ordersQuery = admin
        .from("trendyol_orders")
        .select(
          "id, order_number, net_amount, gross_amount, total_price, commission_amount, order_date, internal_status, customer_first_name, customer_last_name"
        )
        .neq("internal_status", "cancelled")
        .order("order_date", { ascending: false });
      if (from) ordersQuery = ordersQuery.gte("order_date", from);
      if (to) ordersQuery = ordersQuery.lte("order_date", to);
      const { data: orderRows, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;
      orders = orderRows || [];

      const orderIds = orders.map((o) => o.id);
      if (orderIds.length) {
        let poQuery = admin
          .from("producer_orders")
          .select(
            "id, producer_id, producer_earning, material_support, status, created_at, shipped_at, trendyol_order_id, trendyol_orders!trendyol_order_id(order_number, order_date, is_manual), profiles:producer_id(full_name, username)"
          )
          .in("status", PAYABLE_PRODUCER_ORDER_STATUSES)
          .in("trendyol_order_id", orderIds)
          .order("created_at", { ascending: false });
        if (producerId) poQuery = poQuery.eq("producer_id", producerId);
        const { data: poRows, error: poError } = await poQuery;
        if (poError) throw poError;
        producerOrders = poRows || [];
      }

      if (producerId && !orderIds.length) {
        producerOrders = [];
        orders = [];
      } else if (producerId) {
        // Üretici seçiliyse gelir yalnızca onun bağlı siparişleriyle
        const linkedIds = new Set(
          producerOrders.map((po) => po.trendyol_order_id).filter(Boolean)
        );
        orders = orders.filter((o) => linkedIds.has(o.id));
      }
    } else {
      // Varsayılan: kargolanma tarihi (shipped_at)
      let poQuery = admin
        .from("producer_orders")
        .select(
          "id, producer_id, producer_earning, material_support, status, created_at, shipped_at, trendyol_order_id, trendyol_orders!trendyol_order_id(order_number, order_date, is_manual), profiles:producer_id(full_name, username)"
        )
        .in("status", PAYABLE_PRODUCER_ORDER_STATUSES)
        .not("shipped_at", "is", null)
        .order("shipped_at", { ascending: false });

      if (from) poQuery = poQuery.gte("shipped_at", from);
      if (to) poQuery = poQuery.lte("shipped_at", to);
      if (producerId) poQuery = poQuery.eq("producer_id", producerId);

      const { data: poRows, error: poError } = await poQuery;
      if (poError) throw poError;
      producerOrders = poRows || [];

      const orderIds = [
        ...new Set(
          producerOrders.map((po) => po.trendyol_order_id).filter(Boolean)
        ),
      ];
      if (orderIds.length) {
        const { data: orderRows, error: ordersError } = await admin
          .from("trendyol_orders")
          .select(
            "id, order_number, net_amount, gross_amount, total_price, commission_amount, order_date, internal_status, customer_first_name, customer_last_name"
          )
          .in("id", orderIds)
          .neq("internal_status", "cancelled")
          .order("order_date", { ascending: false });
        if (ordersError) throw ordersError;
        orders = orderRows || [];
      }
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
    const materialSupport = (producerOrders || []).reduce(
      (sum, row) => sum + Number(row.material_support || 0),
      0
    );

    let starQuery = admin
      .from("star_bonus_entries")
      .select(
        "id, producer_id, amount, note, entry_type, quantity, created_at, profiles:producer_id(full_name, username)"
      )
      .order("created_at", { ascending: false });
    if (from) starQuery = starQuery.gte("created_at", from);
    if (to) starQuery = starQuery.lte("created_at", to);
    if (producerId) starQuery = starQuery.eq("producer_id", producerId);
    const { data: starBonuses, error: starError } = await starQuery;
    if (starError) throw starError;
    const starBonus = (starBonuses || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );
    const netProfit = roundMoney(
      profitRows.reduce((sum, row) => sum + Number(row.netProfit || 0), 0)
    );

    return NextResponse.json({
      payments: payments || [],
      starBonuses: starBonuses || [],
      producerOrders: producerOrders || [],
      orders: ordersWithProfit,
      dateField,
      settings,
      summary: {
        income: roundMoney(income),
        expense: roundMoney(expense),
        producerEarnings: roundMoney(producerEarnings),
        materialSupport: roundMoney(materialSupport),
        starBonus: roundMoney(starBonus),
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
      kind: body.kind === "campaign" ? "campaign" : "manual",
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

export async function DELETE(request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const id = body.id || new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Ödeme gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: payment, error: findError } = await admin
      .from("payments")
      .select("id, amount, profiles:producer_id(full_name, username)")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw findError;
    if (!payment) {
      return NextResponse.json({ error: "Ödeme bulunamadı" }, { status: 404 });
    }

    const { error } = await admin.from("payments").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      deleted: {
        id: payment.id,
        amount: payment.amount,
        producerName: payment.profiles?.full_name || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
