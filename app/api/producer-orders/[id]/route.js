import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
      .select("*")
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

    const updates = {
      updated_at: new Date().toISOString(),
    };
    if (body.status) {
      // Kargolama = üretici görevi bitti → otomatik tamamlandı
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
