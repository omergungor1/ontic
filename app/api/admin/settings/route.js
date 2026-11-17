import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAutoAssignSettings,
  parseClock,
  saveAutoAssignSettings,
} from "@/lib/auto-settings";

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const settings = await getAutoAssignSettings(admin);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    if (parseClock(body.start) == null || parseClock(body.end) == null) {
      return NextResponse.json(
        { error: "Saat aralığı SS:DD biçiminde olmalı" },
        { status: 400 }
      );
    }
    if (parseClock(body.start) === parseClock(body.end)) {
      return NextResponse.json(
        { error: "Başlangıç ve bitiş saati farklı olmalı" },
        { status: 400 }
      );
    }
    const admin = createAdminClient();
    const settings = await saveAutoAssignSettings(admin, {
      enabled: Boolean(body.enabled),
      start: body.start,
      end: body.end,
    });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
