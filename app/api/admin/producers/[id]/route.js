import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decryptPassword, encryptPassword } from "@/lib/crypto";
import { parsePersonMultiplier } from "@/lib/person-multiplier";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { logStockChange } from "@/lib/stock-log";

export async function GET(_request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();

    const { data: producer, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .eq("role", "producer")
      .single();
    if (error) throw error;

    const { data: products } = await admin
      .from("producer_products")
      .select("*, products(*)")
      .eq("producer_id", id)
      .order("is_active", { ascending: false });

    return NextResponse.json({
      producer: {
        ...producer,
        decrypted_password: decryptPassword(producer.encrypted_password),
      },
      products: products || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    if (body.phone !== undefined) {
      const phone = normalizePhone(body.phone, { required: true });
      if (!phone) {
        return NextResponse.json(
          { error: "Telefon 05XX XXX XX XX formatında olmalıdır" },
          { status: 400 }
        );
      }
      body.phone = phone;
    }

    if (body.email !== undefined) {
      const email = String(body.email || "").trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: "Geçerli bir e-posta girin" },
          { status: 400 }
        );
      }
      body.email = email || null;
    }

    if (body.personMultiplier !== undefined) {
      const personMultiplier = parsePersonMultiplier(body.personMultiplier);
      if (!personMultiplier) {
        return NextResponse.json(
          { error: "Kişi çarpanı 1 veya daha büyük bir tam sayı olmalıdır" },
          { status: 400 }
        );
      }
      body.personMultiplier = personMultiplier;
    }

    const updates = {
      full_name: body.fullName,
      phone: body.phone,
      city: body.city,
      district: body.district,
      iban: body.iban,
      email: body.email,
      admin_note: body.adminNote,
      person_multiplier: body.personMultiplier,
      is_active: body.isActive,
      updated_at: new Date().toISOString(),
    };

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) delete updates[key];
    });

    if (body.password) {
      updates.encrypted_password = encryptPassword(body.password);
      const { error: authError } = await admin.auth.admin.updateUserById(id, {
        password: body.password,
      });
      if (authError) throw authError;
    }

    const { error } = await admin.from("profiles").update(updates).eq("id", id);
    if (error) {
      if (/person_multiplier/i.test(error.message || "")) {
        throw new Error(
          "profiles.person_multiplier sütunu yok. Supabase SQL Editor'da scripts/add-person-multiplier.sql dosyasını çalıştırın."
        );
      }
      if (/email/i.test(error.message || "")) {
        throw new Error(
          "profiles.email sütunu yok. Supabase SQL Editor'da şunu çalıştırın: alter table public.profiles add column if not exists email text;"
        );
      }
      throw error;
    }

    if (Array.isArray(body.productAssignments)) {
      for (const item of body.productAssignments) {
        const nextStock = Number(item.stockQuantity || 0);
        const { data: existing } = await admin
          .from("producer_products")
          .select("id, stock_quantity")
          .eq("producer_id", id)
          .eq("product_id", item.productId)
          .maybeSingle();

        const { data: upserted, error: upsertError } = await admin
          .from("producer_products")
          .upsert(
            {
              producer_id: id,
              product_id: item.productId,
              is_active: Boolean(item.isActive),
              stock_quantity: nextStock,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "producer_id,product_id" }
          )
          .select("id, stock_quantity")
          .single();
        if (upsertError) throw upsertError;

        const prevStock = existing
          ? Number(existing.stock_quantity || 0)
          : 0;
        if (prevStock !== nextStock) {
          await logStockChange(admin, {
            producerId: id,
            productId: item.productId,
            producerProductId: upserted?.id || existing?.id,
            previousQuantity: prevStock,
            newQuantity: nextStock,
            source: "admin",
            createdBy: user.id,
            syncCampaigns: false,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
