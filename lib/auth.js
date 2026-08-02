import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(String(email).toLowerCase());
}

export function producerEmailFromUsername(username) {
  const clean = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${clean}@ontic.com.tr`;
}

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    return { user, profile };
  }

  // Admin ilk girişte profil oluştur
  if (isAdminEmail(user.email)) {
    const admin = createAdminClient();
    const { data: upserted } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          role: "admin",
          full_name: user.email,
          is_active: true,
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    return { user, profile: upserted };
  }

  return { user, profile: null };
}

export async function requireAdmin() {
  const current = await getCurrentProfile();
  if (!current?.user || current.profile?.role !== "admin") {
    const error = new Error("Yetkisiz");
    error.status = 401;
    throw error;
  }
  return current;
}

export async function requireProducer() {
  const current = await getCurrentProfile();
  if (!current?.user || current.profile?.role !== "producer") {
    const error = new Error("Yetkisiz");
    error.status = 401;
    throw error;
  }
  return current;
}
