import { createAdminClient } from "@/lib/supabase/admin";
import { assignOrder } from "@/lib/assign-orders";
import { refreshOrderInternalStatus } from "@/lib/sync";
import { normalizePersonMultiplier } from "@/lib/person-multiplier";
import { sendAutoAssignHoldMail } from "@/lib/mail";
import { getAutoAssignSettings } from "@/lib/auto-settings";
import {
  CONFIRM_HOURS,
  TIMEOUT_NOTE,
  filterCandidates,
  isExpirable,
  planAssignment,
  scoreProducers,
  shouldNotifyHold,
  shouldRunAutoAssign,
} from "./auto-assign-plan.js";

export {
  MAX_SHORTAGE,
  MAX_PRODUCERS,
  CONFIRM_HOURS,
  NEW_PRODUCER_DAYS,
  TIMEOUT_NOTE,
  SCORE,
  filterCandidates,
  isExpirable,
  planAssignment,
  scoreProducers,
  shouldNotifyHold,
  shouldRunAutoAssign,
} from "./auto-assign-plan.js";

const OPEN_STATUSES = ["created", "confirmed", "ready"];
const DAY_MS = 24 * 60 * 60 * 1000;
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function loadProducerBoard(admin, now = Date.now()) {
  const since = new Date(now - 30 * DAY_MS).toISOString();
  const [{ data: profiles, error: profileError }, { data: links }, { data: openRows }, { data: recent }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, is_active, person_multiplier, max_open_orders, created_at")
        .eq("role", "producer"),
      admin
        .from("producer_products")
        .select("producer_id, product_id, stock_quantity, is_active")
        .eq("is_active", true),
      admin.from("producer_orders").select("producer_id").in("status", OPEN_STATUSES),
      admin
        .from("producer_orders")
        .select("producer_id, status, producer_earning, created_at, shipped_at")
        .gte("created_at", since)
        .limit(5000),
    ]);
  if (profileError) throw profileError;

  const openCount = {};
  for (const row of openRows || []) {
    openCount[row.producer_id] = (openCount[row.producer_id] || 0) + 1;
  }

  const earnings = {};
  const rejects = {};
  const speeds = {};
  for (const row of recent || []) {
    if (["completed", "shipped"].includes(row.status)) {
      earnings[row.producer_id] =
        (earnings[row.producer_id] || 0) + Number(row.producer_earning || 0);
      if (row.shipped_at && row.created_at) {
        const hours =
          (new Date(row.shipped_at).getTime() - new Date(row.created_at).getTime()) /
          (60 * 60 * 1000);
        if (hours >= 0) {
          speeds[row.producer_id] = speeds[row.producer_id] || [];
          speeds[row.producer_id].push(hours);
        }
      }
    }
    if (row.status === "rejected") {
      rejects[row.producer_id] = (rejects[row.producer_id] || 0) + 1;
    }
  }

  const stock = {};
  const openProducts = {};
  for (const link of links || []) {
    stock[link.producer_id] = stock[link.producer_id] || {};
    stock[link.producer_id][link.product_id] = Number(link.stock_quantity || 0);
    openProducts[link.producer_id] = openProducts[link.producer_id] || new Set();
    openProducts[link.producer_id].add(link.product_id);
  }

  return (profiles || []).map((profile) => {
    const created = profile.created_at ? new Date(profile.created_at).getTime() : now;
    return {
      id: profile.id,
      name: profile.full_name || "",
      inactive: !profile.is_active,
      multiplier: normalizePersonMultiplier(profile.person_multiplier),
      maxOpen: profile.max_open_orders == null ? null : Number(profile.max_open_orders),
      openCount: openCount[profile.id] || 0,
      earnings30: earnings[profile.id] || 0,
      rejects30: rejects[profile.id] || 0,
      medianHours: median(speeds[profile.id] || []),
      ageDays: Math.max(0, (now - created) / DAY_MS),
      createdAt: profile.created_at,
      stock: stock[profile.id] || {},
      open: openProducts[profile.id] || new Set(),
    };
  });
}

async function expireStaleOrders(admin, now) {
  const cutoff = new Date(now - CONFIRM_HOURS * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin
    .from("producer_orders")
    .select("id, status, created_at, trendyol_order_id, producer_order_items(order_item_id, quantity, product_id)")
    .eq("status", "created")
    .lt("created_at", cutoff);
  if (error) throw error;

  const { releaseProducerOrder } = await import("@/lib/producer-orders");
  let expired = 0;
  for (const row of rows || []) {
    if (!isExpirable(row, now)) continue;
    await releaseProducerOrder(admin, row, "cancelled", { skipRefresh: true });
    await admin
      .from("producer_orders")
      .update({ notes: TIMEOUT_NOTE, updated_at: new Date(now).toISOString() })
      .eq("id", row.id);
    if (row.trendyol_order_id) {
      await refreshOrderInternalStatus(row.trendyol_order_id);
    }
    expired += 1;
  }
  return expired;
}

export async function runAutoDistribution(admin = createAdminClient(), now = new Date()) {
  const settings = await getAutoAssignSettings(admin);
  if (!shouldRunAutoAssign(settings, now)) {
    return {
      ran: false,
      reason: settings.enabled ? "outside" : "disabled",
      expired: 0,
      assigned: 0,
      held: 0,
      mailed: 0,
    };
  }

  const expired = await expireStaleOrders(admin, now.getTime());
  const board = await loadProducerBoard(admin, now.getTime());
  const { data: orders, error } = await admin
    .from("trendyol_orders")
    .select("id, order_number, auto_notified_at, internal_status")
    .in("internal_status", ["pending_assignment", "partially_assigned"])
    .order("order_date", { ascending: true })
    .limit(100);
  if (error) throw error;

  const orderIds = (orders || []).map((order) => order.id);
  if (!orderIds.length) {
    return { ran: true, expired, assigned: 0, held: 0, mailed: 0 };
  }

  const [{ data: items }, { data: history }, { data: prices }] = await Promise.all([
    admin
      .from("trendyol_order_items")
      .select("id, order_id, product_id, product_name, quantity, assigned_quantity")
      .in("order_id", orderIds),
    admin
      .from("producer_orders")
      .select("trendyol_order_id, producer_id, status, notes")
      .in("trendyol_order_id", orderIds)
      .in("status", ["rejected", "cancelled"]),
    admin.from("products").select("id, producer_price"),
  ]);

  const priceById = new Map(
    (prices || []).map((row) => [row.id, Number(row.producer_price || 0)])
  );
  const blocked = new Map();
  for (const row of history || []) {
    const timedOut = row.status === "cancelled" && row.notes === TIMEOUT_NOTE;
    if (row.status !== "rejected" && !timedOut) continue;
    const set = blocked.get(row.trendyol_order_id) || new Set();
    set.add(row.producer_id);
    blocked.set(row.trendyol_order_id, set);
  }

  let assigned = 0;
  let held = 0;
  let mailed = 0;
  const openCounts = Object.fromEntries(board.map((row) => [row.id, row.openCount]));

  for (const order of orders || []) {
    const lines = (items || [])
      .filter((item) => item.order_id === order.id)
      .map((item) => ({
        orderItemId: item.id,
        productId: item.product_id,
        title: item.product_name,
        quantity: Number(item.quantity || 0) - Number(item.assigned_quantity || 0),
      }))
      .filter((item) => item.quantity > 0);
    if (!lines.length) continue;

    const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);
    const blockedIds = blocked.get(order.id) || new Set();
    const candidates = filterCandidates(
      board.map((row) => ({
        ...row,
        openCount: openCounts[row.id] || 0,
        blocked: blockedIds.has(row.id),
      })),
      totalQty
    );
    const scored = scoreProducers(candidates, { smallOrder: totalQty <= 2 });
    const plan = planAssignment(lines, scored);

    if (!plan) {
      held += 1;
      if (shouldNotifyHold(order)) {
        let stamp = false;
        try {
          const mail = await sendAutoAssignHoldMail({
            orderNumber: order.order_number,
            orderId: order.id,
            items: lines.map((line) => ({
              title: line.title,
              quantity: line.quantity,
            })),
          });
          stamp = true;
          if (mail.sent) mailed += 1;
        } catch (err) {
          console.error("[auto-assign] admin maili gidemedi", err?.message || err);
        }
        if (stamp) {
          await admin
            .from("trendyol_orders")
            .update({ auto_notified_at: new Date(now).toISOString() })
            .eq("id", order.id);
        }
      }
      continue;
    }

    try {
      await assignOrder(admin, {
        orderId: order.id,
        assignments: plan.map((part) => ({
          producerId: part.producerId,
          items: part.lines.map((line) => ({
            orderItemId: line.orderItemId,
            productId: line.productId,
            quantity: line.quantity,
            unitEarning: priceById.get(line.productId) || 0,
          })),
        })),
      });
      for (const part of plan) {
        openCounts[part.producerId] = (openCounts[part.producerId] || 0) + 1;
      }
      if (order.auto_notified_at) {
        await admin
          .from("trendyol_orders")
          .update({ auto_notified_at: null })
          .eq("id", order.id);
      }
      assigned += 1;
    } catch (err) {
      console.error("[auto-assign] atama başarısız", order.order_number, err?.message || err);
    }
  }

  return { ran: true, expired, assigned, held, mailed };
}
