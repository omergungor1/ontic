import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request) {
  try {
    const current = await getCurrentProfile();
    if (!current?.profile) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const before = searchParams.get("before");
    const limit = Math.min(Number(searchParams.get("limit") || 20), 50);
    const admin = createAdminClient();

    let query = admin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) query = query.lt("created_at", before);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      messages: (data || []).reverse(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile();
    if (!current?.profile) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const body = await request.json();
    const admin = createAdminClient();
    let conversationId = body.conversationId;

    if (!conversationId && body.producerId && current.profile.role === "admin") {
      const { data: existing } = await admin
        .from("conversations")
        .select("id")
        .eq("producer_id", body.producerId)
        .maybeSingle();

      if (existing) {
        conversationId = existing.id;
      } else {
        const { data: created, error } = await admin
          .from("conversations")
          .insert({ producer_id: body.producerId })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = created.id;
      }
    }

    if (!conversationId && current.profile.role === "producer") {
      const { data: existing } = await admin
        .from("conversations")
        .select("id")
        .eq("producer_id", current.user.id)
        .maybeSingle();
      if (existing) conversationId = existing.id;
      else {
        const { data: created, error } = await admin
          .from("conversations")
          .insert({ producer_id: current.user.id })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = created.id;
      }
    }

    const { data: message, error } = await admin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: current.user.id,
        body: body.body || null,
        image_url: body.imageUrl || null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await admin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({ ok: true, message, conversationId });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
