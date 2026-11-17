const MAX_PERSON_MULTIPLIER = 999;

export function normalizePersonMultiplier(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PERSON_MULTIPLIER);
}

export function parsePersonMultiplier(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PERSON_MULTIPLIER) return null;
  return n;
}

export function sendQuantity(quantity, multiplier) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  return qty * normalizePersonMultiplier(multiplier);
}
