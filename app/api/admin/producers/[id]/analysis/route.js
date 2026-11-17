import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadProducerBoard, scoreProducers } from "@/lib/auto-assign";

export async function GET(_request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    const board = await loadProducerBoard(admin);
    const row = board.find((item) => item.id === id);
    if (!row) {
      return NextResponse.json({ error: "Üretici bulunamadı" }, { status: 404 });
    }

    const scored = scoreProducers(
      board.filter((item) => !item.inactive),
      { smallOrder: false }
    );
    const mine = scored.find((item) => item.id === id) || row;
    const stocks = Object.values(row.stock || {});
    const units = stocks.reduce((sum, value) => sum + Number(value || 0), 0);

    return NextResponse.json({
      analysis: {
        id: row.id,
        name: row.name,
        inactive: row.inactive,
        ageDays: Math.floor(row.ageDays),
        createdAt: row.createdAt,
        multiplier: row.multiplier,
        earnings30: Math.round(row.earnings30),
        perCapita: Math.round(mine.perCapita || 0),
        openCount: row.openCount,
        maxOpen: row.maxOpen,
        medianHours: row.medianHours == null ? null : Math.round(row.medianHours * 10) / 10,
        rejects30: row.rejects30,
        score: Math.round((mine.score || 0) * 10) / 10,
        stock: {
          products: stocks.length,
          units,
          low: stocks.filter((value) => Number(value) <= 2).length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
