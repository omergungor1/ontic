import { NextResponse } from "next/server";
import {
  producerEmailFromUsername,
  requireAdmin,
} from "@/lib/auth";
import { encryptPassword } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("*")
      .eq("role", "producer")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ producers: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const rawUsername = String(body.username || "").trim().toLowerCase();
    const username = rawUsername.replace(/[^a-z0-9]/g, "");
    const fullName = String(body.fullName || "").trim();
    const city = String(body.city || "").trim();
    const district = String(body.district || "").trim();
    const password = String(body.password || "");
    const phone = normalizePhone(body.phone, { required: true });
    const iban = String(body.iban || "").trim();
    const adminNote = String(body.adminNote || "").trim();

    if (!username || !fullName || !password) {
      return NextResponse.json(
        { error: "Username, ad soyad ve şifre zorunlu" },
        { status: 400 }
      );
    }

    if (username !== rawUsername || !/^[a-z0-9]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Kullanıcı adı sadece harf ve rakamlardan oluşmalı, boşluk içeremez",
        },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Telefon 05XX XXX XX XX formatında olmalıdır" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Bu kullanıcı adı zaten kullanılıyor" },
        { status: 409 }
      );
    }

    const email = producerEmailFromUsername(username);
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "producer",
          username,
          full_name: fullName,
          phone,
          city,
          district,
        },
      });

    if (createError) throw createError;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: created.user.id,
      role: "producer",
      username,
      full_name: fullName,
      phone: phone || null,
      city: city || null,
      district: district || null,
      iban: iban || null,
      admin_note: adminNote || null,
      encrypted_password: encryptPassword(password),
      is_active: true,
    });

    if (profileError) throw profileError;

    await admin.from("conversations").upsert({
      producer_id: created.user.id,
    });

    return NextResponse.json({ ok: true, id: created.user.id });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Üretici eklenemedi" },
      { status: error.status || 500 }
    );
  }
}
