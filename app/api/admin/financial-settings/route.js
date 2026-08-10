import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_FINANCIAL_SETTINGS,
  getStoreFinancialSettings,
} from "@/lib/net-profit";

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const settings = await getStoreFinancialSettings(admin);
    return NextResponse.json({ settings });
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
    const admin = createAdminClient();
    const current = await getStoreFinancialSettings(admin);

    const fields = [
      "sales_vat_rate",
      "commission_vat_rate",
      "cargo_price",
      "cargo_vat_rate",
      "platform_service_fee",
      "platform_service_fee_vat_rate",
      "income_tax_rate",
    ];

    const updates = { updated_at: new Date().toISOString() };
    for (const key of fields) {
      if (body[key] === undefined || body[key] === null || body[key] === "") {
        continue;
      }
      const num = Number(body[key]);
      if (!Number.isFinite(num) || num < 0) {
        return NextResponse.json(
          { error: `Geçersiz değer: ${key}` },
          { status: 400 }
        );
      }
      updates[key] = num;
    }

    const { data, error } = await admin
      .from("store_financial_settings")
      .update(updates)
      .eq("id", current.id)
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      settings: data || { ...DEFAULT_FINANCIAL_SETTINGS, ...updates },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
