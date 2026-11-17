import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dayEndIso,
  dayStartIso,
  listCampaignEligibleProducers,
} from "@/lib/campaigns";

export async function GET(_request, { params }) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { id } = await params;
    const { data: campaign, error } = await admin
      .from("stock_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!campaign) {
      return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
    }

    const producers = await listCampaignEligibleProducers(admin, campaign);
    return NextResponse.json({ campaign, producers });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kampanya alınamadı" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    await requireAdmin();
    const body = await request.json();
    const admin = createAdminClient();
    const { id } = await params;

    const patch = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) {
      patch.title = String(body.title || "").trim() || null;
    }
    if (body.startDate || body.startsAt) {
      patch.starts_at = body.startsAt || dayStartIso(body.startDate);
    }
    if (body.endDate || body.endsAt) {
      patch.ends_at = body.endsAt || dayEndIso(body.endDate);
    }
    if (body.targetStock !== undefined) {
      const target = Number(body.targetStock);
      if (!Number.isFinite(target) || target <= 0) {
        return NextResponse.json(
          { error: "Hedef stok pozitif olmalı" },
          { status: 400 }
        );
      }
      patch.target_stock = Math.round(target);
    }
    if (body.rewardAmount !== undefined) {
      const reward = Number(body.rewardAmount);
      if (!Number.isFinite(reward) || reward < 0) {
        return NextResponse.json(
          { error: "Ödül tutarı geçersiz" },
          { status: 400 }
        );
      }
      patch.reward_amount = reward;
    }
    if (body.isActive !== undefined) {
      patch.is_active = Boolean(body.isActive);
    }

    if (patch.starts_at && patch.ends_at) {
      if (new Date(patch.ends_at) <= new Date(patch.starts_at)) {
        return NextResponse.json(
          { error: "Bitiş tarihi başlangıçtan sonra olmalı" },
          { status: 400 }
        );
      }
    }

    const { data, error } = await admin
      .from("stock_campaigns")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ campaign: data });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kampanya güncellenemedi" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin
      .from("stock_campaigns")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kampanya silinemedi" },
      { status: error.status || 500 }
    );
  }
}
