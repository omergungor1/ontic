import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const SOURCE_LABELS = {
  manual: "Üretici manuel",
  shipment: "Kargo düşümü",
  admin: "Admin güncellemesi",
  restore: "İptal stok iadesi",
};

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const producerId = searchParams.get("producerId");
    const productId = searchParams.get("productId");
    const limit = Math.min(Number(searchParams.get("limit") || 100), 300);

    if (!producerId || !productId) {
      return NextResponse.json(
        { error: "producerId ve productId gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const [{ data: product }, { data: profile }, { data: logs, error }] =
      await Promise.all([
        admin
          .from("products")
          .select("id, title, image_url")
          .eq("id", productId)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("id, full_name, username")
          .eq("id", producerId)
          .maybeSingle(),
        admin
          .from("stock_change_logs")
          .select(
            "id, previous_quantity, new_quantity, delta, source, created_at, created_by"
          )
          .eq("producer_id", producerId)
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

    if (error) throw error;

    return NextResponse.json({
      product,
      producer: profile,
      logs: (logs || []).map((row) => ({
        id: row.id,
        previousQuantity: Number(row.previous_quantity || 0),
        newQuantity: Number(row.new_quantity || 0),
        delta: Number(row.delta || 0),
        source: row.source,
        sourceLabel: SOURCE_LABELS[row.source] || row.source,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Stok geçmişi alınamadı" },
      { status: error.status || 500 }
    );
  }
}
