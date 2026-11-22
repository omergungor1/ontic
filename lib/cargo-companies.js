export function slugCargoCode(name) {
  const letters = {
    ç: "c",
    ğ: "g",
    ı: "i",
    i̇: "i",
    ö: "o",
    ş: "s",
    ü: "u",
  };
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => letters[char] || char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "kargo";
}

export async function resolveCargoCompanyId(admin, value, currentId) {
  if (value === "" || value == null) return null;
  const { data, error } = await admin
    .from("cargo_companies")
    .select("id, is_active")
    .eq("id", value)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const missing = new Error("Kargo firması bulunamadı");
    missing.status = 400;
    throw missing;
  }
  if (!data.is_active && data.id !== currentId) {
    const inactive = new Error("Bu kargo firması pasif");
    inactive.status = 400;
    throw inactive;
  }
  return data.id;
}
