import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 25;

const ACTION_LABELS = {
  assigned: "Atandı",
  held: "Bekletildi",
  expired: "Süresi doldu",
  kept: "Kalıcı",
};

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || PAGE_SIZE), 1),
      50
    );

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("auto_assign_logs")
      .select(
        "id, created_at, action, detail, trendyol_order_id, producer_id, profiles:producer_id(full_name), trendyol_orders!trendyol_order_id(order_number)"
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit);

    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      logs: page.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        action: row.action,
        actionLabel: ACTION_LABELS[row.action] || row.action,
        detail: row.detail,
        orderId: row.trendyol_order_id,
        orderNumber: row.trendyol_orders?.order_number || null,
        producerName: row.profiles?.full_name || null,
      })),
      hasMore,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kayıtlar alınamadı" },
      { status: error.status || 500 }
    );
  }
}
