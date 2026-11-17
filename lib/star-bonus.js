import { roundMoney } from "@/lib/net-profit";

function unitsOf(delta) {
  return Math.max(0, Math.round(Math.abs(Number(delta) || 0)));
}

async function loadProduct(admin, productId) {
  const { data, error } = await admin
    .from("products")
    .select("id, title, is_starred, star_bonus")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function insertEntry(admin, row) {
  const { error } = await admin.from("star_bonus_entries").insert(row);
  if (error) throw error;
}

async function creditLots(admin, params, units) {
  const product = await loadProduct(admin, params.productId);
  const unitBonus = roundMoney(product?.star_bonus);
  if (!product?.is_starred || unitBonus <= 0) return { amount: 0 };

  const amount = roundMoney(units * unitBonus);
  const title = product.title || "Ürün";
  const { data: lot, error } = await admin
    .from("star_bonus_lots")
    .insert({
      producer_id: params.producerId,
      product_id: params.productId,
      producer_product_id: params.producerProductId || null,
      unit_bonus: unitBonus,
      quantity: units,
      open_quantity: units,
      locked_quantity: 0,
      clawed_quantity: 0,
    })
    .select("id")
    .single();
  if (error) throw error;

  await insertEntry(admin, {
    producer_id: params.producerId,
    product_id: params.productId,
    producer_product_id: params.producerProductId || null,
    stock_change_log_id: params.stockChangeLogId || null,
    entry_type: "credit",
    quantity: units,
    unit_bonus: unitBonus,
    amount,
    note: `Yıldızlı ürün bonusu · ${title} · ${units} adet`,
  });

  return { amount, lotId: lot.id };
}

async function consumeLots(admin, params, units, mode) {
  const ascending = mode !== "unlock";
  const column = mode === "unlock" ? "locked_quantity" : "open_quantity";
  const { data: lots, error } = await admin
    .from("star_bonus_lots")
    .select(
      "id, unit_bonus, quantity, open_quantity, locked_quantity, clawed_quantity, created_at"
    )
    .eq("producer_id", params.producerId)
    .eq("product_id", params.productId)
    .gt(column, 0)
    .order("created_at", { ascending });
  if (error) throw error;

  let left = units;
  let movedUnits = 0;
  let amount = 0;

  for (const lot of lots || []) {
    if (left <= 0) break;
    const available = Number(lot[column] || 0);
    const take = Math.min(left, available);
    if (take <= 0) continue;

    const open = Number(lot.open_quantity || 0);
    const locked = Number(lot.locked_quantity || 0);
    const clawed = Number(lot.clawed_quantity || 0);
    const next = {
      open_quantity: open,
      locked_quantity: locked,
      clawed_quantity: clawed,
    };

    if (mode === "clawback") {
      next.open_quantity = open - take;
      next.clawed_quantity = clawed + take;
      amount = roundMoney(amount + take * Number(lot.unit_bonus || 0));
    } else if (mode === "lock") {
      next.open_quantity = open - take;
      next.locked_quantity = locked + take;
    } else {
      next.locked_quantity = locked - take;
      next.open_quantity = open + take;
    }

    const { error: updateError } = await admin
      .from("star_bonus_lots")
      .update(next)
      .eq("id", lot.id);
    if (updateError) throw updateError;

    left -= take;
    movedUnits += take;
  }

  if (mode === "clawback" && movedUnits > 0) {
    const product = await loadProduct(admin, params.productId);
    const title = product?.title || "Ürün";
    await insertEntry(admin, {
      producer_id: params.producerId,
      product_id: params.productId,
      producer_product_id: params.producerProductId || null,
      stock_change_log_id: params.stockChangeLogId || null,
      entry_type: "clawback",
      quantity: movedUnits,
      unit_bonus: roundMoney(amount / movedUnits),
      amount: roundMoney(-amount),
      note: `Yıldızlı ürün bonusu geri alındı · ${title} · ${movedUnits} adet`,
    });
    return { amount: roundMoney(-amount) };
  }

  return { amount: 0 };
}

/**
 * Üretici yıldızlı ürünü stoğa ekleyince bonus yazar.
 * Elle stok düşünce açık bonus geri alınır.
 * Sipariş düşümü bonusu kilitler, iptal iadesi yeniden açar; ikisi de tutarı değiştirmez.
 */
export async function applyStarBonusForStockChange(admin, params) {
  const units = unitsOf(params.delta);
  if (!units || !params.producerId || !params.productId) return { amount: 0 };

  const delta = Number(params.delta || 0);
  if (params.source === "manual" && delta > 0) {
    return creditLots(admin, params, units);
  }
  if (
    (params.source === "manual" || params.source === "admin") &&
    delta < 0
  ) {
    return consumeLots(admin, params, units, "clawback");
  }
  if (params.source === "shipment" && delta < 0) {
    return consumeLots(admin, params, units, "lock");
  }
  if (params.source === "restore" && delta > 0) {
    return consumeLots(admin, params, units, "unlock");
  }
  return { amount: 0 };
}
