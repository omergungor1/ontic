import { NextResponse } from "next/server";
import { requireProducer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateProducerProductStock } from "@/lib/stock-log";

export async function PATCH(request) {
  try {
    const { user } = await requireProducer();
    const body = await request.json();
    const producerProductId = body.id || body.producerProductId;
    const quantity = Number(body.quantity);

    if (!producerProductId) {
      return NextResponse.json({ error: "Ürün gerekli" }, { status: 400 });
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Geçersiz stok" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: owned, error: ownedError } = await admin
      .from("producer_products")
      .select("id, producer_id, product_id, stock_quantity")
      .eq("id", producerProductId)
      .eq("producer_id", user.id)
      .maybeSingle();
    if (ownedError) throw ownedError;
    if (!owned) {
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }

    const result = await updateProducerProductStock(admin, {
      producerProductId: owned.id,
      producerId: user.id,
      productId: owned.product_id,
      newQuantity: quantity,
      source: "manual",
      createdBy: user.id,
    });

    return NextResponse.json({
      ok: true,
      quantity: result.newQuantity ?? quantity,
      delta: result.delta || 0,
      changed: result.changed,
      starBonus: Number(result.starBonusAmount || 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Stok güncellenemedi" },
      { status: error.status || 500 }
    );
  }
}
