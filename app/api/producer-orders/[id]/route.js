import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseProducerOrder, deductProducerStockOnShip } from "@/lib/producer-orders";

export async function PATCH(request, { params }) {
  try {
    const current = await getCurrentProfile();
    if (!current?.profile) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    const { data: order } = await admin
      .from("producer_orders")
      .select("*, producer_order_items(*)")
      .eq("id", id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Sipariş yok" }, { status: 404 });
    }

    const isOwner = order.producer_id === current.user.id;
    const isAdmin = current.profile.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    // Üretici reddi: yalnızca sahibi ve henüz onaylanmamış sipariş
    if (body.status === "rejected") {
      if (!isOwner) {
        return NextResponse.json(
          { error: "Siparişi yalnızca üretici reddedebilir" },
          { status: 403 }
        );
      }
      if (order.status !== "created") {
        return NextResponse.json(
          { error: "Yalnızca onay bekleyen sipariş reddedilebilir" },
          { status: 400 }
        );
      }
      await releaseProducerOrder(admin, order, "rejected");
      return NextResponse.json({ ok: true });
    }

    const updates = {
      updated_at: new Date().toISOString(),
    };
    if (body.status) {
      const markingShipped =
        (body.status === "completed" || body.status === "shipped") &&
        order.status === "ready" &&
        isOwner;

      if (markingShipped) {
        await deductProducerStockOnShip(admin, order);
      }

      updates.status =
        body.status === "shipped" ? "completed" : body.status;
    }
    if (body.cargoImageUrl !== undefined) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Kargo kodunu yalnızca yönetici yükleyebilir" },
          { status: 403 }
        );
      }
      updates.cargo_image_url = body.cargoImageUrl;
    }
    if (body.notes !== undefined && isAdmin) updates.notes = body.notes;

    const { error } = await admin
      .from("producer_orders")
      .update(updates)
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
