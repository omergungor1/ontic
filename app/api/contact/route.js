import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

export async function POST(request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const phone = normalizePhone(body.phone, { required: true });
    const message = String(body.message || "").trim();

    if (!fullName || !phone || !message) {
      return NextResponse.json(
        {
          error: !phone
            ? "Telefon 05XX XXX XX XX formatında olmalıdır"
            : "Ad soyad, telefon ve mesaj zorunludur",
        },
        { status: 400 }
      );
    }

    if (message.length < 5) {
      return NextResponse.json(
        { error: "Mesaj en az 5 karakter olmalıdır" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Mesaj en fazla 2000 karakter olabilir" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.from("contact_messages").insert({
      full_name: fullName,
      phone,
      message,
      status: "new",
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Mesaj kaydedilemedi" },
      { status: 500 }
    );
  }
}
