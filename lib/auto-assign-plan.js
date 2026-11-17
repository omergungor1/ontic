import { normalizePersonMultiplier } from "./person-multiplier.js";
import { isWithinAutoAssignWindow } from "./auto-settings.js";

export const MAX_SHORTAGE = 2;
export const MAX_PRODUCERS = 2;
export const CONFIRM_HOURS = 3;
export const NEW_PRODUCER_DAYS = 7;
export const TIMEOUT_NOTE = "auto:timeout";

export const SCORE = {
  balance: 25,
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
  const age = now - new Date(order.created_at).getTime();
  return age >= CONFIRM_HOURS * 60 * 60 * 1000;
}

export function shouldNotifyHold(order) {
  return !order?.auto_notified_at;
}

export function filterCandidates(producers, totalQty) {
  return (producers || []).filter((producer) => {
    if (!producer || producer.inactive || producer.blocked) return false;
    if (
      producer.maxOpen != null &&
      Number(producer.openCount || 0) >= Number(producer.maxOpen)
    ) {
      return false;
    }
    if (Number(producer.ageDays) < NEW_PRODUCER_DAYS && totalQty > 2) {
      return false;
    }
    return true;
  });
}

export function scoreProducers(rows, { smallOrder = false } = {}) {
  const perCapita = rows.map(
    (row) =>
      Number(row.earnings30 || 0) /
      Math.max(1, normalizePersonMultiplier(row.multiplier))
  );
  const maxPer = Math.max(...perCapita, 1);
  const speeds = rows
    .map((row) => row.medianHours)
    .filter((value) => value != null && Number.isFinite(value));
  const slowest = Math.max(...speeds, 1);

  return rows.map((row, index) => {
    const speed =
      row.medianHours == null
        ? 0
        : (1 - Number(row.medianHours) / slowest) * SCORE.speed;
    const balance = (1 - perCapita[index] / maxPer) * SCORE.balance;
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

function shortageOf(producer, lines) {
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
  if (short > MAX_SHORTAGE) return null;
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

function snapshot(pair, buckets) {
  const shorts = pair.map((producer, index) => {
    if (!buckets[index].length) return 0;
    return shortageOf(producer, buckets[index]);
  });
  if (shorts.some((value) => value == null)) return null;
  const used = buckets.filter((lines) => lines.length).length;
  if (!used || used > MAX_PRODUCERS) return null;
  return {
    shortage: shorts.reduce((sum, value) => sum + value, 0),
    score: pair.reduce(
      (sum, producer, index) =>
        sum + (buckets[index].length ? producer.score : 0),
      0
    ),
    assignments: pair
      .map((producer, index) => ({
        producerId: producer.id,
        lines: buckets[index].map((line) => ({ ...line })),
      }))
      .filter((item) => item.lines.length),
  };
}

function searchPair(pair, lines) {
  const buckets = pair.map(() => []);
  let best = null;

  function place(index) {
    if (index === lines.length) {
      best = better(snapshot(pair, buckets), best);
      return;
    }
    const line = lines[index];
    for (let slot = 0; slot < pair.length; slot += 1) {
      buckets[slot].push(line);
      if (shortageOf(pair[slot], buckets[slot]) != null) place(index + 1);
      buckets[slot].pop();
    }
    if (line.quantity > 1 && line.quantity <= 20 && lines.length <= 3) {
      for (let take = 1; take < line.quantity; take += 1) {
        buckets[0].push({ ...line, quantity: take });
        buckets[1].push({ ...line, quantity: line.quantity - take });
        if (
          shortageOf(pair[0], buckets[0]) != null &&
          shortageOf(pair[1], buckets[1]) != null
        ) {
          place(index + 1);
        }
        buckets[0].pop();
        buckets[1].pop();
      }
    }
  }

  place(0);
  return best;
}

export function planAssignment(lines, producers) {
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
  if (!remaining.length || !producers?.length) return null;

  const single = [];
  for (const producer of producers) {
    const short = shortageOf(producer, remaining);
    if (short == null) continue;
    single.push({
      shortage: short,
      score: Number(producer.score || 0),
      assignments: [{ producerId: producer.id, lines: remaining }],
    });
  }
  const bestSingle = single.reduce((best, item) => better(item, best), null);
  if (bestSingle) return bestSingle.assignments;

  if (remaining.length > 8) return null;

  let best = null;
  for (let i = 0; i < producers.length; i += 1) {
    for (let j = i + 1; j < producers.length; j += 1) {
      best = better(searchPair([producers[i], producers[j]], remaining), best);
    }
  }
  return best ? best.assignments : null;
}
