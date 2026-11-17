import { NextResponse } from "next/server";
import { requireProducer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildProducerCampaignCards } from "@/lib/campaigns";

export async function GET() {
  try {
    const { user } = await requireProducer();
    const admin = createAdminClient();
    const campaigns = await buildProducerCampaignCards(admin, user.id);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kampanyalar alınamadı" },
      { status: error.status || 500 }
    );
  }
}
