import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sendTestMail } from "@/lib/mail";

export async function POST() {
  try {
    await requireAdmin();
    const data = await sendTestMail("omergungorco@gmail.com");
    return NextResponse.json({ ok: true, id: data?.id || null });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Test maili gönderilemedi" },
      { status: error.status || 500 }
    );
  }
}
