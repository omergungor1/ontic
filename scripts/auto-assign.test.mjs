import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_ASSIGN_NOTE,
  AUTO_KEEP_NOTE,
  assignmentReason,
  balanceReady,
  chooseAssignment,
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
  const everyone = [producer("a", { p: 10 }, 1), producer("b", { p: 3 }, 50)];
  const plan = chooseAssignment([line("a", "p", 10)], everyone, everyone);
  assert.deepEqual(plan, [
    { producerId: "a", lines: [line("a", "p", 10)] },
  ]);
});

test("eksik 2 kabul, ürün birden fazla kişide açıkken eksik 3 kalır", () => {
  const allowed = planAssignment(
    [line("a", "p", 6)],
    [producer("a", { p: 4 })]
  );
  assert.equal(allowed[0].producerId, "a");
  assert.equal(allowed[0].lines[0].quantity, 6);

  const everyone = [producer("a", { p: 3 }), producer("b", { p: 1 })];
  assert.equal(chooseAssignment([line("a", "p", 6)], everyone, everyone), null);
});

test("ürün tek kişide açıksa stok sıfır olsa da ona kalır", () => {
  const elif = producer("elif", { p: 0 }, 0, { name: "Elif Acar" });
  const plan = chooseAssignment([line("a", "p", 6)], [elif], []);
  assert.equal(plan[0].producerId, "elif");
  assert.equal(plan[0].keep, true);
  assert.equal(plan[0].lines[0].quantity, 6);
});

test("tek kişi yetmezse sipariş bölünmez", () => {
  const everyone = [producer("a", { p: 6 }, 5), producer("b", { p: 4 }, 1)];
  const plan = chooseAssignment([line("a", "p", 10)], everyone, everyone);
  assert.equal(plan, null);
});

test("üç üretici gerekirken otomatik plan yok", () => {
  const everyone = [
    producer("a", { p: 2 }),
    producer("b", { p: 2 }),
    producer("c", { p: 2 }),
  ];
  const plan = chooseAssignment([line("a", "p", 10)], everyone, everyone);
  assert.equal(plan, null);
});

test("yalnızca bir üreticide açık ürün ona gider", () => {
  const everyone = [
    producer("a", { ozel: 5, ortak: 0 }, 1),
    producer("b", { ortak: 5 }, 20),
  ];
  const plan = chooseAssignment(
    [line("a", "ozel", 1), line("b", "ortak", 1)],
    everyone,
    everyone
  );
  assert.ok(plan.some((part) => part.producerId === "a"));
  const special = plan
    .flatMap((part) => part.lines.map((item) => ({ ...item, producerId: part.producerId })))
    .find((item) => item.productId === "ozel");
  assert.equal(special.producerId, "a");
});

test("düşük eksik, yüksek skoru geçer", () => {
  const everyone = [producer("slow", { p: 10 }, 1), producer("fast", { p: 8 }, 100)];
  const plan = chooseAssignment([line("a", "p", 10)], everyone, everyone);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].producerId, "slow");
});

test("yeni hesap büyük siparişte elenir, küçük siparişte kalır", () => {
  const newbie = producer("n", { p: 5 }, 0, { ageDays: 2 });
  assert.equal(filterCandidates([newbie], 3).length, 0);
  assert.equal(filterCandidates([newbie], 2).length, 1);
});

test("bekleyen sipariş 2 ise yeni atama yapılmaz", () => {
  const rows = [
    producer("dolu", { p: 5 }, 0, { openCount: 2 }),
    producer("genis", { p: 5 }, 0, { openCount: 2, maxOpen: 8 }),
    producer("bos", { p: 1 }, 0, { openCount: 1 }),
  ];
  assert.deepEqual(
    filterCandidates(rows, 1).map((row) => row.id),
    ["bos"]
  );
});

test("ürünü tek üreten kişinin bekleyen siparişi çok olsa da ona kalır", () => {
  const elif = producer("elif", { p: 0 }, 0, { openCount: 10, name: "Elif Acar" });
  const plan = chooseAssignment([line("a", "p", 4)], [elif], []);
  assert.equal(plan[0].producerId, "elif");
  assert.equal(plan[0].keep, true);
});

test("oto ataması kapalı üretici tek üreten olsa da elenir", () => {
  const rows = [
    producer("test", { p: 8 }, 0, { skipAutoAssign: true }),
    producer("gercek", { p: 1 }),
  ];
  assert.deepEqual(
    filterCandidates(rows, 1).map((row) => row.id),
    ["gercek"]
  );
  const only = [producer("test", { p: 0 }, 0, { skipAutoAssign: true })];
  assert.equal(chooseAssignment([line("a", "p", 2)], only, only), null);
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

test("süre aşımı yalnızca oto atanmış ve 3 saati geçmiş created kaydını seçer", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  const old = new Date(now - 3 * 60 * 60 * 1000).toISOString();
  assert.equal(
    isExpirable(
      { status: "created", notes: AUTO_ASSIGN_NOTE, created_at: old },
      now
    ),
    true
  );
  assert.equal(
    isExpirable(
      { status: "created", notes: null, created_at: old },
      now
    ),
    false
  );
  assert.equal(
    isExpirable(
      {
        status: "created",
        notes: AUTO_ASSIGN_NOTE,
        created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      },
      now
    ),
    false
  );
  assert.equal(
    isExpirable(
      { status: "created", notes: AUTO_KEEP_NOTE, created_at: old },
      now
    ),
    false
  );
  for (const status of ["confirmed", "ready", "shipped", "completed", "rejected"]) {
    assert.equal(
      isExpirable(
        {
          status,
          notes: AUTO_ASSIGN_NOTE,
          created_at: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
        },
        now
      ),
      false
    );
  }
});

test("tek üretici ataması kalıcı diye açıklanır", () => {
  const text = assignmentReason({ name: "Elif Acar" }, 6, { keep: true });
  assert.match(text, /Elif Acar bu ürünü üreten tek kişi/);
  assert.match(text, /Atama kalıcı/);
});

test("yeni üretici atama açıklamasında öne çıkar", () => {
  const text = assignmentReason(
    { name: "Ayşe", ageDays: 3 },
    1
  );
  assert.match(text, /Yeni üretici Ayşe/);
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
    producer("low", {}, 0, { earnings30: 300, multiplier: 3, ageDays: 40 }),
    producer("high", {}, 0, { earnings30: 900, multiplier: 1, ageDays: 40 }),
  ]);
  assert.ok(low.score > high.score);
});

test("yeni üretici sıfır geliriyle gelir denkliğinden puan almaz", () => {
  const [newbie, veteran] = scoreProducers([
    producer("new", {}, 0, { earnings30: 0, ageDays: 4 }),
    producer("old", {}, 0, { earnings30: 4000, ageDays: 60 }),
  ]);
  assert.equal(balanceReady(newbie), false);
  assert.ok(newbie.score <= veteran.score);
});

test("yeni aktif edilen üretici bir haftalık boşluğu kovalamaz", () => {
  const [back, low, high] = scoreProducers([
    producer("back", {}, 0, { earnings30: 0, ageDays: 80, activatedDays: 6 }),
    producer("low", {}, 0, { earnings30: 200, ageDays: 80 }),
    producer("high", {}, 0, { earnings30: 2000, ageDays: 80 }),
  ]);
  assert.equal(balanceReady(back), false);
  assert.ok(back.score < low.score);
  assert.ok(low.score > high.score);
});

test("süre notu sabiti red kaydından ayrılır", () => {
  assert.equal(TIMEOUT_NOTE, "auto:timeout");
});
