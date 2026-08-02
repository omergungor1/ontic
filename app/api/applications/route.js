import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

export async function POST(request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const phone = normalizePhone(body.phone, { required: true });
    const city = String(body.city || "").trim();
    const district = String(body.district || "").trim();

    if (!fullName || !phone || !city || !district) {
      return NextResponse.json(
        {
          error: !phone
            ? "Telefon 05XX XXX XX XX formatında olmalıdır"
            : "Tüm alanlar zorunludur",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.from("producer_applications").insert({
      full_name: fullName,
      phone,
      city,
      district,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Bu telefon numarası ile daha önce başvuru yapılmış" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Başvuru kaydedilemedi" },
      { status: 500 }
    );
  }
}
