import { createHash, timingSafeEqual } from "crypto";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { syncOrdersFromTrendyol } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bearerOk(request) {
  const expected = process.env.CRON_BEARER_TOKEN || "";
  if (!expected) return false;

  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return false;

  const given = createHash("sha256").update(match[1]).digest();
  const want = createHash("sha256").update(expected).digest();
  return timingSafeEqual(given, want);
}

async function handle(request) {
  if (!bearerOk(request)) notFound();

  try {
    const result = await syncOrdersFromTrendyol({ days: 30 });
    // Aşama 2: yeni siparişlerin üreticilere otomatik dağıtımı burada duracak.
    return NextResponse.json({ ok: true, synced: result.synced, skipped: result.skipped });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
