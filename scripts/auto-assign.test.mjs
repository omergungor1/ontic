import test from "node:test";
import assert from "node:assert/strict";
import {
  filterCandidates,
  isExpirable,
  planAssignment,
  scoreProducers,
  shouldNotifyHold,
  shouldRunAutoAssign,
  TIMEOUT_NOTE,
} from "../lib/auto-assign-plan.js";
import { isWithinAutoAssignWindow } from "../lib/auto-settings.js";

function producer(id, stock, score = 0, extra = {}) {
  return {
    id,
    open: new Set(Object.keys(stock)),
    stock,
    score,
    inactive: false,
    blocked: false,
    maxOpen: null,
    openCount: 0,
    ageDays: 30,
    earnings30: 0,
    multiplier: 1,
    medianHours: null,
    rejects30: 0,
    ...extra,
  };
}

function line(id, productId, quantity) {
  return { orderItemId: id, productId, quantity };
}

test("10 adet stoktaysa siparişin tamamı o üreticiye gider", () => {
  const plan = planAssignment(
    [line("a", "p", 10)],
    [producer("a", { p: 10 }, 1), producer("b", { p: 3 }, 50)]
  );
  assert.deepEqual(plan, [
    { producerId: "a", lines: [line("a", "p", 10)] },
  ]);
});

test("eksik 2 kabul, eksik 3 tek başına kalır", () => {
  const allowed = planAssignment(
    [line("a", "p", 6)],
    [producer("a", { p: 4 })]
  );
  assert.equal(allowed[0].producerId, "a");
  assert.equal(allowed[0].lines[0].quantity, 6);

  const blocked = planAssignment(
    [line("a", "p", 6)],
    [producer("a", { p: 3 })]
  );
  assert.equal(blocked, null);
});

test("tek kişi yetmezse en fazla ikiye bölünür", () => {
  const plan = planAssignment(
    [line("a", "p", 10)],
    [producer("a", { p: 6 }, 5), producer("b", { p: 4 }, 1)]
  );
  assert.equal(plan.length, 2);
  const qty = plan
    .flatMap((part) => part.lines)
    .reduce((sum, item) => sum + item.quantity, 0);
  assert.equal(qty, 10);
  for (const part of plan) {
    const owner = part.producerId === "a" ? 6 : 4;
    const taken = part.lines.reduce((sum, item) => sum + item.quantity, 0);
    assert.ok(taken - owner <= 2);
  }
});

test("üç üretici gerekirken otomatik plan yok", () => {
  const plan = planAssignment(
    [line("a", "p", 10)],
    [
      producer("a", { p: 2 }),
      producer("b", { p: 2 }),
      producer("c", { p: 2 }),
    ]
  );
  assert.equal(plan, null);
});

test("yalnızca bir üreticide açık ürün ona gider", () => {
  const plan = planAssignment(
    [line("a", "ozel", 1), line("b", "ortak", 1)],
    [
      producer("a", { ozel: 5, ortak: 0 }, 1),
      producer("b", { ortak: 5 }, 20),
    ]
  );
  assert.ok(plan.some((part) => part.producerId === "a"));
  const special = plan
    .flatMap((part) => part.lines.map((item) => ({ ...item, producerId: part.producerId })))
    .find((item) => item.productId === "ozel");
  assert.equal(special.producerId, "a");
});

test("düşük eksik, yüksek skoru geçer", () => {
  const plan = planAssignment(
    [line("a", "p", 10)],
    [producer("slow", { p: 10 }, 1), producer("fast", { p: 8 }, 100)]
  );
  assert.equal(plan.length, 1);
  assert.equal(plan[0].producerId, "slow");
});

test("yeni hesap büyük siparişte elenir, küçük siparişte kalır", () => {
  const newbie = producer("n", { p: 5 }, 0, { ageDays: 2 });
  assert.equal(filterCandidates([newbie], 3).length, 0);
  assert.equal(filterCandidates([newbie], 2).length, 1);
});

test("limit, pasif ve bu siparişte elenen üretici dışarıda kalır", () => {
  const rows = [
    producer("limit", { p: 5 }, 0, { maxOpen: 2, openCount: 2 }),
    producer("pasif", { p: 5 }, 0, { inactive: true }),
    producer("red", { p: 5 }, 0, { blocked: true }),
    producer("uygun", { p: 5 }),
  ];
  assert.deepEqual(
    filterCandidates(rows, 1).map((row) => row.id),
    ["uygun"]
  );
});

test("süre aşımı yalnızca 3 saati geçmiş created kaydını seçer", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  assert.equal(
    isExpirable(
      { status: "created", created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString() },
      now
    ),
    true
  );
  assert.equal(
    isExpirable(
      { status: "created", created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
      now
    ),
    false
  );
  for (const status of ["confirmed", "ready", "shipped", "completed", "rejected"]) {
    assert.equal(
      isExpirable(
        { status, created_at: new Date(now - 10 * 60 * 60 * 1000).toISOString() },
        now
      ),
      false
    );
  }
});

test("bildirim bir kez gider", () => {
  assert.equal(shouldNotifyHold({ auto_notified_at: null }), true);
  assert.equal(shouldNotifyHold({ auto_notified_at: "2026-11-18T10:00:00Z" }), false);
});

test("anahtar kapalıyken ve saat dışında dağıtım yok", () => {
  const inside = new Date("2026-06-01T10:00:00Z");
  const outside = new Date("2026-06-01T05:00:00Z");
  assert.equal(
    shouldRunAutoAssign({ enabled: false, start: "09:00", end: "22:00" }, inside),
    false
  );
  assert.equal(
    shouldRunAutoAssign({ enabled: true, start: "09:00", end: "22:00" }, outside),
    false
  );
  assert.equal(
    shouldRunAutoAssign({ enabled: true, start: "09:00", end: "22:00" }, inside),
    true
  );
  assert.equal(isWithinAutoAssignWindow({ start: "09:00", end: "22:00" }, new Date("2026-06-01T19:00:00Z")), true);
  assert.equal(isWithinAutoAssignWindow({ start: "09:00", end: "22:00" }, new Date("2026-06-01T19:01:00Z")), false);
});

test("kişi başı kazancı düşük olan daha yüksek skor alır", () => {
  const [low, high] = scoreProducers([
    producer("low", {}, 0, { earnings30: 300, multiplier: 3, ageDays: 30 }),
    producer("high", {}, 0, { earnings30: 900, multiplier: 1, ageDays: 30 }),
  ]);
  assert.ok(low.score > high.score);
});

test("süre notu sabiti red kaydından ayrılır", () => {
  assert.equal(TIMEOUT_NOTE, "auto:timeout");
});
