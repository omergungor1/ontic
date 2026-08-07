import { NextResponse } from "next/server";
import { getCurrentProfile, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const current = await getCurrentProfile();
    if (!current?.profile) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const admin = createAdminClient();
    let query = admin
      .from("product_requests")
      .select(
        "*, profiles!producer_id(id, full_name, username, phone)"
      )
      .order("created_at", { ascending: false });

    if (current.profile.role === "producer") {
      query = query.eq("producer_id", current.user.id);
    } else if (current.profile.role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ rows: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile();
    if (!current?.user || current.profile?.role !== "producer") {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;

    if (!title) {
      return NextResponse.json(
        { error: "Ürün adı gerekli" },
        { status: 400 }
      );
    }
    if (!description) {
      return NextResponse.json(
        { error: "Açıklama gerekli" },
        { status: 400 }
      );
    }
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Ürün görseli gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_requests")
      .insert({
        producer_id: current.user.id,
        title,
        description,
        image_url: imageUrl,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, row: data });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = body.id;
    const status = body.status;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id ve status gerekli" },
        { status: 400 }
      );
    }
    if (!["pending", "approved", "rejected", "archived"].includes(status)) {
      return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
    }

    const admin = createAdminClient();
    const updates = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (body.adminNote !== undefined) {
      updates.admin_note = body.adminNote;
    }

    const { error } = await admin
      .from("product_requests")
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
