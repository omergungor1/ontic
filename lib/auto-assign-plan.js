import { normalizePersonMultiplier } from "./person-multiplier.js";
import { isWithinAutoAssignWindow } from "./auto-settings.js";

export const MAX_SHORTAGE = 2;
export const MAX_PRODUCERS = 1;
export const MAX_PENDING_ORDERS = 2;
export const CONFIRM_HOURS = 3;
export const NEW_PRODUCER_DAYS = 7;
export const BALANCE_READY_DAYS = 30;
const BALANCE_BAND = 0.4;
export const TIMEOUT_NOTE = "auto:timeout";
export const AUTO_ASSIGN_NOTE = "auto:assign";
export const AUTO_KEEP_NOTE = "auto:keep";

export const SCORE = {
  balance: 10,
  speed: 15,
  openPenalty: 8,
  rejectPenalty: 10,
  newBonus: 15,
};

export function shouldRunAutoAssign(settings, now = new Date()) {
  return Boolean(settings?.enabled) && isWithinAutoAssignWindow(settings, now);
}

export function isExpirable(order, now = Date.now()) {
  if (!order || order.status !== "created" || !order.created_at) return false;
  if (order.notes !== AUTO_ASSIGN_NOTE) return false;
  const age = now - new Date(order.created_at).getTime();
  return age >= CONFIRM_HOURS * 60 * 60 * 1000;
}

export function assignmentReason(producer, shortage, { keep = false } = {}) {
  const name = producer?.name || "Üretici";
  const missing = Number(shortage || 0);
  if (keep) {
    return `${name} bu ürünü üreten tek kişi. Eksik ${missing} adet. Atama kalıcı.`;
  }
  if (Number(producer?.ageDays) < NEW_PRODUCER_DAYS) {
    return `Yeni üretici ${name} öne çıkarıldı. Eksik ${missing} adet. Tek üreticiye atandı.`;
  }
  if (missing === 0) {
    return `${name} stoğu siparişi karşılıyor. Tek üreticiye atandı.`;
  }
  return `${name} seçildi. Eksik ${missing} adet, en az eksik ve skor sırası. Tek üreticiye atandı.`;
}

export function shouldNotifyHold(order) {
  return !order?.auto_notified_at;
}

export function pendingLimit(producer) {
  const adminLimit =
    producer?.maxOpen == null ? MAX_PENDING_ORDERS : Number(producer.maxOpen);
  return Math.min(MAX_PENDING_ORDERS, adminLimit);
}

export function balanceReady(producer) {
  if (!producer || Number(producer.ageDays) < BALANCE_READY_DAYS) return false;
  if (producer.activatedDays == null || producer.activatedDays === "") return true;
  return Number(producer.activatedDays) >= BALANCE_READY_DAYS;
}

export function filterCandidates(producers, totalQty) {
  return (producers || []).filter((producer) => {
    if (!producer || producer.inactive || producer.blocked || producer.skipAutoAssign) {
      return false;
    }
    if (Number(producer.openCount || 0) >= pendingLimit(producer)) return false;
    if (Number(producer.ageDays) < NEW_PRODUCER_DAYS && totalQty > 2) {
      return false;
    }
    return true;
  });
}

function medianOf(values) {
  const nums = (values || []).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function scoreProducers(rows, { smallOrder = false } = {}) {
  const perCapita = rows.map(
    (row) =>
      Number(row.earnings30 || 0) /
      Math.max(1, normalizePersonMultiplier(row.multiplier))
  );
  const mid = medianOf(
    perCapita.filter((_, index) => balanceReady(rows[index]))
  );
  const speeds = rows
    .map((row) => row.medianHours)
    .filter((value) => value != null && Number.isFinite(value));
  const slowest = Math.max(...speeds, 1);

  return rows.map((row, index) => {
    const speed =
      row.medianHours == null
        ? 0
        : (1 - Number(row.medianHours) / slowest) * SCORE.speed;
    let balance = 0;
    if (balanceReady(row) && mid > 0) {
      const gap = (mid - perCapita[index]) / mid;
      const clamped = Math.max(-BALANCE_BAND, Math.min(BALANCE_BAND, gap));
      balance = (clamped / BALANCE_BAND) * SCORE.balance;
    }
    const openPenalty = Number(row.openCount || 0) * SCORE.openPenalty;
    const rejectPenalty = Number(row.rejects30 || 0) * SCORE.rejectPenalty;
    const bonus =
      smallOrder && Number(row.ageDays) < NEW_PRODUCER_DAYS ? SCORE.newBonus : 0;
    return {
      ...row,
      perCapita: perCapita[index],
      score: balance + speed - openPenalty - rejectPenalty + bonus,
    };
  });
}

export function shortageOf(producer, lines, { unlimited = false } = {}) {
  if (!producer) return null;
  const need = {};
  for (const line of lines) {
    if (!producer.open?.has(line.productId)) return null;
    need[line.productId] = (need[line.productId] || 0) + Number(line.quantity);
  }
  let short = 0;
  for (const [productId, qty] of Object.entries(need)) {
    short += Math.max(0, qty - Number(producer.stock?.[productId] || 0));
  }
  if (!unlimited && short > MAX_SHORTAGE) return null;
  return short;
}

function better(next, best) {
  if (!next) return best;
  if (!best) return next;
  if (next.shortage !== best.shortage) {
    return next.shortage < best.shortage ? next : best;
  }
  return next.score > best.score ? next : best;
}

function normalizeLines(lines) {
  const remaining = [];
  const seen = new Map();
  for (const line of lines || []) {
    const quantity = Number(line.quantity) || 0;
    if (!line?.orderItemId || !line?.productId || quantity <= 0) continue;
    const key = String(line.orderItemId);
    const current = seen.get(key);
    if (current) current.quantity += quantity;
    else {
      const next = {
        orderItemId: line.orderItemId,
        productId: line.productId,
        quantity,
      };
      seen.set(key, next);
      remaining.push(next);
    }
  }
  return remaining;
}

function covers(producer, lines) {
  return lines.every((line) => producer?.open?.has(line.productId));
}

export function exclusiveAssignment(lines, producers) {
  const remaining = normalizeLines(lines);
  if (!remaining.length) return null;
  const covering = (producers || []).filter(
    (producer) =>
      producer &&
      !producer.inactive &&
      !producer.blocked &&
      !producer.skipAutoAssign &&
      covers(producer, remaining)
  );
  if (covering.length !== 1) return null;
  return [
    {
      producerId: covering[0].id,
      lines: remaining,
      keep: true,
    },
  ];
}

export function planAssignment(lines, producers) {
  const remaining = normalizeLines(lines);
  if (!remaining.length || !producers?.length) return null;

  const single = [];
  for (const producer of producers) {
    if (producer?.skipAutoAssign) continue;
    const short = shortageOf(producer, remaining);
    if (short == null) continue;
    single.push({
      shortage: short,
      score: Number(producer.score || 0),
      assignments: [{ producerId: producer.id, lines: remaining }],
    });
  }
  const bestSingle = single.reduce((best, item) => better(item, best), null);
  if (!bestSingle || bestSingle.assignments.length > MAX_PRODUCERS) return null;
  return bestSingle.assignments;
}

export function chooseAssignment(lines, everyone, eligible) {
  return exclusiveAssignment(lines, everyone) || planAssignment(lines, eligible);
}
