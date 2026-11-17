import assert from "node:assert/strict";
import test from "node:test";
import {
  applySplitCancellations,
  planSplitCancellations,
  SPLIT_CANCEL_REASON,
} from "../lib/split-packages.js";

const ORIGINAL = {
  id: 4356850065,
  shipmentPackageId: 4356850065,
  orderNumber: "11838897101",
  createdBy: "order-creation",
  originPackageIds: null,
  status: "UnPacked",
};

const SPLIT_A = {
  id: 4358332471,
  shipmentPackageId: 4358332471,
  orderNumber: "11838897101",
  createdBy: "split",
  originPackageIds: [4356850065],
  status: "Picking",
};

const SPLIT_B = {
  id: 4358332472,
  shipmentPackageId: 4358332472,
  orderNumber: "11838897101",
  createdBy: "split",
  originPackageIds: [4356850065],
  status: "Picking",
};

function createAdmin(state) {
  function run(ctx) {
    const table = state[ctx.table];
    if (ctx.action === "select") {
      let rows = table.slice();
      for (const [column, value] of ctx.filters) {
        if (Array.isArray(value)) {
          const allowed = new Set(value.map(String));
          rows = rows.filter((row) => allowed.has(String(row[column])));
        } else {
          rows = rows.filter((row) => String(row[column]) === String(value));
        }
      }
      return { data: rows, error: null };
    }

    let rows = table.slice();
    for (const [column, value] of ctx.filters) {
      rows = rows.filter((row) => String(row[column]) === String(value));
    }
    for (const [column, value] of ctx.neq) {
      rows = rows.filter((row) => String(row[column]) !== String(value));
    }
    for (const row of rows) Object.assign(row, ctx.payload);
    return { data: rows.map((row) => ({ id: row.id })), error: null };
  }

  return {
    from(table) {
      const ctx = { table, filters: [], neq: [], action: "select", payload: null };
      const api = {
        select() {
          return api;
        },
        eq(column, value) {
          ctx.filters.push([column, value]);
          return api;
        },
        neq(column, value) {
          ctx.neq.push([column, value]);
          return api;
        },
        in(column, value) {
          ctx.filters.push([column, value]);
          return api;
        },
        update(payload) {
          ctx.action = "update";
          ctx.payload = payload;
          return api;
        },
        then(resolve, reject) {
          try {
            resolve(run(ctx));
          } catch (error) {
            reject(error);
          }
        },
      };
      return api;
    },
  };
}

test("normal siparişte originPackageIds yoksa iptal planı boştur", () => {
  const plan = planSplitCancellations([
    { shipmentPackageId: 1, orderNumber: "A", originPackageIds: null },
    { shipmentPackageId: 2, orderNumber: "A" },
  ]);
  assert.deepEqual(plan, []);
});

test("bir paket ikiye bölününce yalnızca kaynak paket iptal edilir", () => {
  const plan = planSplitCancellations([ORIGINAL, SPLIT_A, SPLIT_B]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].packageId, "4356850065");
  assert.deepEqual(plan[0].replacedByPackageIds.sort(), ["4358332471", "4358332472"]);
});

test("createdBy split olsa bile originPackageIds yoksa iptal edilmez", () => {
  const plan = planSplitCancellations([
    { shipmentPackageId: 9, orderNumber: "A", createdBy: "split", originPackageIds: null },
  ]);
  assert.deepEqual(plan, []);
});

test("aynı sipariş numarası tek başına iptal sebebi değildir", () => {
  const plan = planSplitCancellations([
    { shipmentPackageId: 10, orderNumber: "11838897101", status: "Picking" },
    { shipmentPackageId: 11, orderNumber: "11838897101", status: "Picking" },
  ]);
  assert.deepEqual(plan, []);
});

test("birden fazla kaynak paket tek tek iptal planına girer", () => {
  const plan = planSplitCancellations([
    { shipmentPackageId: 30, orderNumber: "B", originPackageIds: [10, 20] },
  ]);
  assert.deepEqual(
    plan.map((item) => item.packageId).sort(),
    ["10", "20"]
  );
});

test("bölünmüş paket yeniden bölününce ara paket de iptal edilir", () => {
  const plan = planSplitCancellations([
    { shipmentPackageId: 2, orderNumber: "C", originPackageIds: [1] },
    { shipmentPackageId: 3, orderNumber: "C", originPackageIds: [2] },
  ]);
  assert.deepEqual(
    plan.map((item) => item.packageId).sort(),
    ["1", "2"]
  );
  assert.equal(
    plan.find((item) => item.packageId === "3"),
    undefined
  );
});

test("paket kendi kimliğini kaynak diye yazarsa kendini iptal ettirmez", () => {
  const plan = planSplitCancellations([
    { shipmentPackageId: 5, orderNumber: "D", originPackageIds: [5] },
  ]);
  assert.deepEqual(plan, []);
});

test("üç paket veritabanında varken kaynak iptal, bölünenler aktif kalır", async () => {
  const state = {
    trendyol_orders: [
      { id: "o1", trendyol_package_id: 4356850065, order_number: "11838897101", internal_status: "pending_assignment" },
      { id: "o2", trendyol_package_id: 4358332471, order_number: "11838897101", internal_status: "pending_assignment" },
      { id: "o3", trendyol_package_id: 4358332472, order_number: "11838897101", internal_status: "pending_assignment" },
    ],
    producer_orders: [],
  };
  const released = [];
  const result = await applySplitCancellations(
    createAdmin(state),
    [ORIGINAL, SPLIT_A, SPLIT_B],
    { releaseProducerOrder: async (_admin, order) => released.push(order.id) }
  );

  assert.deepEqual(result.cancelled.map((item) => item.packageId), ["4356850065"]);
  assert.equal(state.trendyol_orders[0].internal_status, "cancelled");
  assert.equal(state.trendyol_orders[0].cancel_reason, SPLIT_CANCEL_REASON);
  assert.deepEqual(state.trendyol_orders[0].replaced_by_package_ids, [4358332471, 4358332472]);
  assert.equal(state.trendyol_orders[1].internal_status, "pending_assignment");
  assert.equal(state.trendyol_orders[2].internal_status, "pending_assignment");
  assert.deepEqual(released, []);
});

test("kaynak paket önceki senkronda kayıtlıysa sonraki pakette iptal edilir", async () => {
  const state = {
    trendyol_orders: [
      { id: "o1", trendyol_package_id: 4356850065, order_number: "11838897101", internal_status: "assigned" },
    ],
    producer_orders: [],
  };
  const result = await applySplitCancellations(
    createAdmin(state),
    [SPLIT_A, SPLIT_B],
    { releaseProducerOrder: async () => {} }
  );
  assert.equal(result.cancelled.length, 1);
  assert.equal(state.trendyol_orders[0].internal_status, "cancelled");
});

test("kaynak veritabanında yoksa senkron hata vermez", async () => {
  const state = { trendyol_orders: [], producer_orders: [] };
  const result = await applySplitCancellations(
    createAdmin(state),
    [SPLIT_A],
    { releaseProducerOrder: async () => {} }
  );
  assert.equal(result.cancelled.length, 0);
  assert.equal(result.skipped[0].reason, "missing");
});

test("iptal edilmiş kaynak pakette üretici iptali yeniden çalışmaz", async () => {
  const state = {
    trendyol_orders: [
      { id: "o1", trendyol_package_id: 4356850065, order_number: "11838897101", internal_status: "cancelled" },
    ],
    producer_orders: [
      { id: "p1", trendyol_order_id: "o1", status: "created" },
    ],
  };
  const released = [];
  const result = await applySplitCancellations(
    createAdmin(state),
    [SPLIT_A, SPLIT_B],
    { releaseProducerOrder: async (_admin, order) => released.push(order.id) }
  );
  assert.equal(result.cancelled.length, 0);
  assert.deepEqual(released, []);
});

test("açık üretici siparişi iptal edilir, kargolanan işe dokunulmaz", async () => {
  const state = {
    trendyol_orders: [
      { id: "o1", trendyol_package_id: 4356850065, order_number: "11838897101", internal_status: "assigned" },
    ],
    producer_orders: [
      { id: "open", trendyol_order_id: "o1", status: "confirmed" },
      { id: "shipped", trendyol_order_id: "o1", status: "shipped" },
    ],
  };
  const released = [];
  await applySplitCancellations(createAdmin(state), [ORIGINAL, SPLIT_A], {
    releaseProducerOrder: async (_admin, order) => released.push(order.id),
  });
  assert.deepEqual(released, ["open"]);
  assert.equal(state.producer_orders[1].status, "shipped");
});

test("aynı senkron iki kez çalışınca ikinci iptal yan etkisi yoktur", async () => {
  const state = {
    trendyol_orders: [
      { id: "o1", trendyol_package_id: 4356850065, order_number: "11838897101", internal_status: "pending_assignment" },
    ],
    producer_orders: [
      { id: "open", trendyol_order_id: "o1", status: "ready" },
    ],
  };
  const released = [];
  const admin = createAdmin(state);
  const deps = {
    releaseProducerOrder: async (_admin, order) => released.push(order.id),
  };
  await applySplitCancellations(admin, [SPLIT_A, SPLIT_B], deps);
  await applySplitCancellations(admin, [SPLIT_A, SPLIT_B], deps);
  assert.deepEqual(released, ["open"]);
  assert.equal(state.trendyol_orders[0].internal_status, "cancelled");
});

test("UnPacked görünen kaynak paket bölününce yeniden aktif kalmaz", async () => {
  const state = {
    trendyol_orders: [
      { id: "o1", trendyol_package_id: 4356850065, order_number: "11838897101", internal_status: "pending_assignment", status: "UnPacked" },
    ],
    producer_orders: [],
  };
  await applySplitCancellations(createAdmin(state), [ORIGINAL, SPLIT_A, SPLIT_B], {
    releaseProducerOrder: async () => {},
  });
  assert.equal(state.trendyol_orders[0].internal_status, "cancelled");
});

test("tamamlanmış kaynak paketin kazancı ve stoku için iptal uygulanmaz", async () => {
  const state = {
    trendyol_orders: [
      { id: "o1", trendyol_package_id: 4356850065, order_number: "11838897101", internal_status: "completed" },
    ],
    producer_orders: [
      { id: "shipped", trendyol_order_id: "o1", status: "completed" },
    ],
  };
  const released = [];
  const result = await applySplitCancellations(createAdmin(state), [SPLIT_A], {
    releaseProducerOrder: async (_admin, order) => released.push(order.id),
  });
  assert.equal(result.cancelled.length, 0);
  assert.equal(result.skipped[0].reason, "completed");
  assert.deepEqual(released, []);
  assert.equal(state.trendyol_orders[0].internal_status, "completed");
});

test("farklı sipariş numarasına ait paket aynı kimlikle iptal edilmez", async () => {
  const state = {
    trendyol_orders: [
      { id: "o1", trendyol_package_id: 4356850065, order_number: "999", internal_status: "pending_assignment" },
    ],
    producer_orders: [],
  };
  const result = await applySplitCancellations(createAdmin(state), [SPLIT_A], {
    releaseProducerOrder: async () => {
      throw new Error("çağrılmamalı");
    },
  });
  assert.equal(result.skipped[0].reason, "order-mismatch");
  assert.equal(state.trendyol_orders[0].internal_status, "pending_assignment");
});
