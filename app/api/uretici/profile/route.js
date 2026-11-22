import { NextResponse } from "next/server";
import { requireProducer } from "@/lib/auth";
import { resolveCargoCompanyId } from "@/lib/cargo-companies";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function GET() {
  try {
    const { user } = await requireProducer();
    const admin = createAdminClient();
    let profileResult = await admin
      .from("profiles")
      .select(
        "id, full_name, phone, city, district, iban, email, username, cargo_company_id"
      )
      .eq("id", user.id)
      .single();
    if (
      profileResult.error &&
      /cargo_company_id/i.test(profileResult.error.message || "")
    ) {
      profileResult = await admin
        .from("profiles")
        .select("id, full_name, phone, city, district, iban, email, username")
        .eq("id", user.id)
        .single();
    }
    const { data: profile, error } = profileResult;
    const { data: companies, error: cargoError } = await admin
      .from("cargo_companies")
      .select("id, name, is_active, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (cargoError && !/cargo_companies|schema cache/i.test(cargoError.message || "")) {
      throw cargoError;
    }
    const active = (companies || []).filter((company) => company.is_active);
    const current = (companies || []).find(
      (company) => company.id === profile?.cargo_company_id
    );
    const cargoCompanies = current && !current.is_active
      ? [current, ...active]
      : active;
    return NextResponse.json({ profile, cargoCompanies });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Profil alınamadı" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { user } = await requireProducer();
    const body = await request.json();
    const admin = createAdminClient();

    if (body.cargoOnly) {
      const { data: current } = await admin
        .from("profiles")
        .select("cargo_company_id")
        .eq("id", user.id)
        .maybeSingle();
      const cargoCompanyId = await resolveCargoCompanyId(
        admin,
        body.cargoCompanyId,
        current?.cargo_company_id || null
      );
      const { error } = await admin
        .from("profiles")
        .update({
          cargo_company_id: cargoCompanyId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .eq("role", "producer");
      if (error) throw error;
      return NextResponse.json({ ok: true, cargoCompanyId });
    }

    const phone = normalizePhone(body.phone, { required: true });
    if (!phone) {
      return NextResponse.json(
        { error: "Telefon 05XX XXX XX XX formatında olmalıdır" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(body.email);
    if (email === null) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta girin" },
        { status: 400 }
      );
    }

    const { data: current } = await admin
      .from("profiles")
      .select("cargo_company_id")
      .eq("id", user.id)
      .maybeSingle();
    const cargoCompanyId =
      body.cargoCompanyId === undefined
        ? current?.cargo_company_id || null
        : await resolveCargoCompanyId(
            admin,
            body.cargoCompanyId,
            current?.cargo_company_id || null
          );

    const updates = {
      full_name: String(body.fullName || "").trim() || null,
      phone,
      city: String(body.city || "").trim() || null,
      district: String(body.district || "").trim() || null,
      iban: String(body.iban || "").trim() || null,
      email: email || null,
      cargo_company_id: cargoCompanyId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .eq("role", "producer");
    if (error) {
      if (/cargo_company_id|cargo_companies/i.test(error.message || "")) {
        throw new Error(
          "Kargo firmaları henüz hazır değil. scripts/add-cargo-companies.sql dosyasını çalıştırın."
        );
      }
      if (/email/i.test(error.message || "")) {
        throw new Error(
          "E-posta alanı henüz hazır değil. Lütfen yöneticiye bildirin."
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Profil güncellenemedi" },
      { status: error.status || 500 }
    );
  }
}
