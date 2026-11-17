import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducerCampaignStockBreakdown } from "@/lib/campaigns";

export async function GET(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const producerId = new URL(request.url).searchParams.get("producerId");
    if (!producerId) {
      return NextResponse.json(
        { error: "producerId gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: campaign, error } = await admin
      .from("stock_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!campaign) {
      return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .eq("id", producerId)
      .maybeSingle();

    const breakdown = await getProducerCampaignStockBreakdown(
      admin,
      campaign,
      producerId
    );

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        startsAt: campaign.starts_at,
        endsAt: campaign.ends_at,
        targetStock: campaign.target_stock,
      },
      producer: profile,
      ...breakdown,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Stok detayı alınamadı" },
      { status: error.status || 500 }
    );
  }
}
