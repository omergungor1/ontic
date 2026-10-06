import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildProducerAnalytics } from "@/lib/analytics";

async function fetchAll(queryFactory, pageSize = 1000) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryFactory().range(
      from,
      from + pageSize - 1
    );
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const admin = createAdminClient();

    const producers = await fetchAll(() =>
      admin
        .from("profiles")
        .select("id, full_name, username, is_active, city")
        .eq("role", "producer")
        .order("full_name", { ascending: true })
    );

    let ordersQuery = () => {
      let q = admin
        .from("producer_orders")
        .select(
          "id, producer_id, status, producer_earning, created_at, updated_at"
        )
        .order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      return q;
    };

    const orders = await fetchAll(ordersQuery);
    const orderIds = orders.map((o) => o.id);

    let orderItems = [];
    if (orderIds.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const batch = await fetchAll(() =>
          admin
            .from("producer_order_items")
            .select("producer_order_id, quantity")
            .in("producer_order_id", chunk)
        );
        orderItems = orderItems.concat(batch);
      }
    }

    const producerProducts = await fetchAll(() =>
      admin
        .from("producer_products")
        .select("producer_id, product_id, is_active, stock_quantity")
    );

    const analytics = buildProducerAnalytics({
      producers,
      orders,
      orderItems,
      producerProducts,
    });

    return NextResponse.json({
      ok: true,
      from,
      to,
      ...analytics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Analiz verisi alınamadı" },
      { status: error.status || 500 }
    );
  }
}
