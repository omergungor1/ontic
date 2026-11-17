import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { syncOrdersFromTrendyol, syncProductsFromTrendyol } from "@/lib/sync";
import { runAutoDistribution } from "@/lib/auto-assign";

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const type = body.type || "products";

    if (type === "orders") {
      const result = await syncOrdersFromTrendyol({
        days: Number(body.days || 30),
      });
      let autoAssign = null;
      try {
        autoAssign = await runAutoDistribution();
      } catch (err) {
        console.error("[auto-assign]", err?.message || err);
        autoAssign = { ran: false, reason: "error" };
      }
      return NextResponse.json({ ok: true, ...result, autoAssign });
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
