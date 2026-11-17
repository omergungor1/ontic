export const DEFAULT_AUTO_ASSIGN = {
  enabled: false,
  start: "09:00",
  end: "22:00",
};

export function parseClock(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function normalizeAutoAssign(value) {
  const source = value && typeof value === "object" ? value : {};
  const start = parseClock(source.start) == null ? DEFAULT_AUTO_ASSIGN.start : source.start;
  const end = parseClock(source.end) == null ? DEFAULT_AUTO_ASSIGN.end : source.end;
  return {
    enabled: Boolean(source.enabled),
    start,
    end,
  };
}

export function isWithinAutoAssignWindow(settings, now = new Date()) {
  const start = parseClock(settings?.start);
  const end = parseClock(settings?.end);
  if (start == null || end == null) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const current = hour * 60 + minute;
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}

export async function getAutoAssignSettings(admin) {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "auto_assign")
    .maybeSingle();
  if (error) throw error;
  return normalizeAutoAssign(data?.value);
}

export async function saveAutoAssignSettings(admin, value) {
  const next = normalizeAutoAssign(value);
  const { error } = await admin.from("app_settings").upsert(
    {
      key: "auto_assign",
      value: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw error;
  return next;
}
