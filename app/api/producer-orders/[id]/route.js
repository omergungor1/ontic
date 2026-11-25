import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCargoCompanyId } from "@/lib/cargo-companies";
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
        updates.shipped_at = new Date().toISOString();
      }

      updates.status =
        body.status === "shipped" ? "completed" : body.status;

      if (
        (updates.status === "completed" || updates.status === "shipped") &&
        !order.shipped_at &&
        !updates.shipped_at
      ) {
        updates.shipped_at = new Date().toISOString();
      }
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
    if (body.cargoCompanyId !== undefined) {
      const producerMaySet =
        isOwner &&
        order.status === "created" &&
        (body.status == null || body.status === "confirmed");
      if (!isAdmin && !producerMaySet) {
        return NextResponse.json(
          { error: "Onaydan sonra kargo firması değiştirilemez" },
          { status: 400 }
        );
      }
      updates.cargo_company_id = await resolveCargoCompanyId(
        admin,
        body.cargoCompanyId,
        order.cargo_company_id
      );
    }
    if (
      isOwner &&
      body.status === "confirmed" &&
      order.status === "created" &&
      !updates.cargo_company_id &&
      !order.cargo_company_id
    ) {
      return NextResponse.json(
        { error: "Kargo firması seçin" },
        { status: 400 }
      );
    }
    if (body.notes !== undefined && isAdmin) updates.notes = body.notes;

    const { error } = await admin
      .from("producer_orders")
      .update(updates)
      .eq("id", id);
    if (error) {
      if (/cargo_company_id/i.test(error.message || "")) {
        return NextResponse.json(
          {
            error:
              "Sipariş kargo alanı henüz hazır değil. scripts/add-producer-order-cargo.sql dosyasını çalıştırın.",
          },
          { status: 500 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
