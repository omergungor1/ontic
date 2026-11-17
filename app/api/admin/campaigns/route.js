import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayEndIso, dayStartIso } from "@/lib/campaigns";

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("stock_campaigns")
      .select("*")
      .order("starts_at", { ascending: false });
    if (error) throw error;

    const campaignIds = (data || []).map((c) => c.id);
    let pendingByCampaign = {};
    if (campaignIds.length) {
      const { data: claims } = await admin
        .from("stock_campaign_claims")
        .select("campaign_id, status")
        .in("campaign_id", campaignIds)
        .eq("status", "pending");
      for (const claim of claims || []) {
        pendingByCampaign[claim.campaign_id] =
          (pendingByCampaign[claim.campaign_id] || 0) + 1;
      }
    }

    return NextResponse.json({
      campaigns: (data || []).map((c) => ({
        ...c,
        pendingClaims: pendingByCampaign[c.id] || 0,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kampanyalar alınamadı" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { user } = await requireAdmin();
    const body = await request.json();
    const admin = createAdminClient();

    const startsAt = body.startsAt || dayStartIso(body.startDate);
    const endsAt = body.endsAt || dayEndIso(body.endDate);
    const targetStock = Number(body.targetStock);
    const rewardAmount = Number(body.rewardAmount);

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { error: "Tarih aralığı gerekli" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(targetStock) || targetStock <= 0) {
      return NextResponse.json(
        { error: "Hedef stok pozitif olmalı" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(rewardAmount) || rewardAmount < 0) {
      return NextResponse.json(
        { error: "Ödül tutarı geçersiz" },
        { status: 400 }
      );
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      return NextResponse.json(
        { error: "Bitiş tarihi başlangıçtan sonra olmalı" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("stock_campaigns")
      .insert({
        title: String(body.title || "").trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        target_stock: Math.round(targetStock),
        reward_amount: rewardAmount,
        is_active: body.isActive !== false,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ campaign: data });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kampanya oluşturulamadı" },
      { status: error.status || 500 }
    );
  }
}
