import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { syncOrdersFromTrendyol, syncProductsFromTrendyol } from "@/lib/sync";

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const type = body.type || "products";

    if (type === "orders") {
      const result = await syncOrdersFromTrendyol({
        days: Number(body.days || 30),
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await syncProductsFromTrendyol();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Sync başarısız" },
      { status: error.status || 500 }
    );
  }
}
