import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugCargoCode } from "@/lib/cargo-companies";

const COLUMNS = "id, name, code, sort_order, is_active";

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("cargo_companies")
      .select(COLUMNS)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ companies: (data || []).map(mapRow) });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kargo firmaları alınamadı" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Firma adı gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: last } = await admin
      .from("cargo_companies")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = Number(last?.sort_order || 0) + 10;
    let code = slugCargoCode(name);
    const { data: existing } = await admin
      .from("cargo_companies")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (existing) code = `${code}-${sortOrder}`;

    const { data, error } = await admin
      .from("cargo_companies")
      .insert({
        name,
        code,
        sort_order: sortOrder,
        is_active: true,
      })
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return NextResponse.json({ company: mapRow(data) });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kargo firması eklenemedi" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "Firma gerekli" }, { status: 400 });
    }
    const updates = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Firma adı gerekli" }, { status: 400 });
      }
      updates.name = name;
    }
    if (body.isActive != null) updates.is_active = Boolean(body.isActive);
    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("cargo_companies")
      .update(updates)
      .eq("id", body.id)
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return NextResponse.json({ company: mapRow(data) });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kargo firması güncellenemedi" },
      { status: error.status || 500 }
    );
  }
}
