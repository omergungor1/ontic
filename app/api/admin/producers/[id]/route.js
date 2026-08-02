import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decryptPassword, encryptPassword } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

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
    await requireAdmin();
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

    const updates = {
      full_name: body.fullName,
      phone: body.phone,
      city: body.city,
      district: body.district,
      iban: body.iban,
      admin_note: body.adminNote,
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
    if (error) throw error;

    if (Array.isArray(body.productAssignments)) {
      for (const item of body.productAssignments) {
        await admin.from("producer_products").upsert(
          {
            producer_id: id,
            product_id: item.productId,
            is_active: Boolean(item.isActive),
            stock_quantity: Number(item.stockQuantity || 0),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "producer_id,product_id" }
        );
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
