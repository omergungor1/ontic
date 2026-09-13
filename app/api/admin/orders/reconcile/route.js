import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { refreshOrderInternalStatus } from "@/lib/sync";

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const orderId = body.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "Sipariş gerekli" }, { status: 400 });
    }

    const internalStatus = await refreshOrderInternalStatus(orderId);
    return NextResponse.json({ ok: true, internal_status: internalStatus });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
