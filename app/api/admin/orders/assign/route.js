import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignOrder } from "@/lib/assign-orders";

export async function POST(request) {
  try {
    const { user } = await requireAdmin();
    const body = await request.json();
    const admin = createAdminClient();
    const { mail } = await assignOrder(admin, {
      orderId: body.orderId,
      assignments: body.assignments || [],
    });
    return NextResponse.json({ ok: true, by: user.id, mail });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
