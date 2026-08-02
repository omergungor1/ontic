import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request) {
  try {
    const current = await getCurrentProfile();
    if (!current?.profile) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const bucket = form.get("bucket") || "cargo-images";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();
    const ext = file.name?.split(".").pop() || "jpg";
    const path = `${current.user.id}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({ ok: true, url: publicUrl, path });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
