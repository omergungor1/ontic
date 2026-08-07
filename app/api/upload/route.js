import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function isAllowedCargoFile(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return true;
  if (type.startsWith("image/") || IMAGE_TYPES.has(type)) return true;
  return false;
}

function isAllowedMessageImage(file) {
  const type = String(file.type || "").toLowerCase();
  return type.startsWith("image/");
}

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

    if (bucket === "cargo-images" && !isAllowedCargoFile(file)) {
      return NextResponse.json(
        { error: "Kargo kodu için yalnızca görsel veya PDF yükleyebilirsiniz" },
        { status: 400 }
      );
    }

    if (bucket === "message-images" && !isAllowedMessageImage(file)) {
      return NextResponse.json(
        { error: "Mesaj için yalnızca görsel yükleyebilirsiniz" },
        { status: 400 }
      );
    }

    if (bucket === "announcement-images" && !isAllowedMessageImage(file)) {
      return NextResponse.json(
        { error: "Duyuru için yalnızca görsel yükleyebilirsiniz" },
        { status: 400 }
      );
    }

    if (bucket === "product-request-images" && !isAllowedMessageImage(file)) {
      return NextResponse.json(
        { error: "Ürün talebi için yalnızca görsel yükleyebilirsiniz" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const rawExt = file.name?.split(".").pop()?.toLowerCase();
    const ext =
      rawExt ||
      (String(file.type).includes("pdf") ? "pdf" : "jpg");
    const path = `${current.user.id}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const contentType =
      file.type ||
      (ext === "pdf" ? "application/pdf" : "image/jpeg");

    const { error } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      path,
      contentType,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
