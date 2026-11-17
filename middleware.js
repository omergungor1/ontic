import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

async function cronBearerOk(request) {
  const expected = process.env.CRON_BEARER_TOKEN || "";
  if (!expected) return false;

  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return false;

  const encoder = new TextEncoder();
  const given = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(match[1]))
  );
  const want = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(expected))
  );
  if (given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given[i] ^ want[i];
  return diff === 0;
}

export async function middleware(request) {
  if (request.nextUrl.pathname === "/api/cron/trendyol-sync") {
    if (!(await cronBearerOk(request))) {
      const url = request.nextUrl.clone();
      url.pathname = "/bu-sayfa-yok";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminPath = path.startsWith("/admin");
  const isProducerPath = path.startsWith("/uretici");
  const isAdminLogin = path === "/admin/giris";
  const isProducerLogin = path === "/giris";

  if ((isAdminPath && !isAdminLogin) || (isProducerPath && !isProducerLogin)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = isAdminPath ? "/admin/giris" : "/giris";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin =
      profile?.role === "admin" ||
      adminEmails.includes(String(user.email || "").toLowerCase());

    if (isAdminPath && !isAdminLogin) {
      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/giris";
        return NextResponse.redirect(url);
      }
    }

    if (isProducerPath) {
      if (isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
      if (profile?.role !== "producer" || profile?.is_active === false) {
        const url = request.nextUrl.clone();
        url.pathname = "/giris";
        return NextResponse.redirect(url);
      }
    }
  }

  if ((isAdminLogin || isProducerLogin) && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin =
      profile?.role === "admin" ||
      adminEmails.includes(String(user.email || "").toLowerCase());

    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/uretici";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/uretici/:path*",
    "/giris",
    "/api/cron/trendyol-sync",
  ],
};
