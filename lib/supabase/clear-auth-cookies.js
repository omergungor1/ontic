/**
 * Biriken Supabase oturum çerezlerini temizler.
 * Çok sayıda sb-* çerezi 431 (Request Header Fields Too Large) hatasına yol açabilir.
 */
export function clearSupabaseAuthCookies() {
  if (typeof document === "undefined") return;

  const names = document.cookie
    .split(";")
    .map((entry) => entry.split("=")[0]?.trim())
    .filter((name) => name && name.startsWith("sb-"));

  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}
