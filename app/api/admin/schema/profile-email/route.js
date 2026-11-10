import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const SQL = `alter table public.profiles add column if not exists email text;`;

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("email").limit(1);
    if (error && /email/i.test(error.message)) {
      return NextResponse.json({ ready: false, sql: SQL, error: error.message });
    }
    if (error) throw error;
    return NextResponse.json({ ready: true, sql: SQL });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Kontrol başarısız", sql: SQL },
      { status: error.status || 500 }
    );
  }
}
