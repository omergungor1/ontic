import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveCampaignClaim, rejectCampaignClaim } from "@/lib/campaigns";

export async function POST(request, { params }) {
  try {
    const { user } = await requireAdmin();
    const body = await request.json();
    const admin = createAdminClient();
    const { id: campaignId } = await params;
    const claimId = body.claimId;
    const action = body.action;

    if (!claimId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "claimId ve action (approve/reject) gerekli" },
        { status: 400 }
      );
    }

    // Güvenlik: claim bu kampanyaya ait mi?
    const { data: claim, error } = await admin
      .from("stock_campaign_claims")
      .select("id, campaign_id")
      .eq("id", claimId)
      .maybeSingle();
    if (error) throw error;
    if (!claim || claim.campaign_id !== campaignId) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }

    if (action === "approve") {
      const result = await approveCampaignClaim(admin, claimId, user.id);
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await rejectCampaignClaim(
      admin,
      claimId,
      user.id,
      body.note || ""
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "İşlem başarısız" },
      { status: error.status || 500 }
    );
  }
}
