import { NextResponse } from "next/server";
import { requireProducer } from "@/lib/auth";
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
    const { data: profile, error } = await admin
      .from("profiles")
      .select(
        "id, full_name, phone, city, district, iban, email, username"
      )
      .eq("id", user.id)
      .single();
    if (error) throw error;
    return NextResponse.json({ profile });
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

    const updates = {
      full_name: String(body.fullName || "").trim() || null,
      phone,
      city: String(body.city || "").trim() || null,
      district: String(body.district || "").trim() || null,
      iban: String(body.iban || "").trim() || null,
      email: email || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .eq("role", "producer");
    if (error) {
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
