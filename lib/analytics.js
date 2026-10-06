const COMPLETED_STATUSES = new Set(["completed", "shipped"]);
const FAILED_STATUSES = new Set(["cancelled", "rejected"]);
const ACTIVE_STATUSES = new Set(["created", "confirmed", "ready"]);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function avg(numbers) {
  if (!numbers.length) return null;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function median(numbers) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function shippingHours(order) {
  if (!COMPLETED_STATUSES.has(order.status)) return null;
  const start = new Date(order.created_at).getTime();
  const end = new Date(order.updated_at || order.created_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / HOUR_MS;
}

function emptyProducerStats(producer) {
  return {
    id: producer.id,
    fullName: producer.full_name || "İsimsiz",
    username: producer.username || null,
    isActive: Boolean(producer.is_active),
    city: producer.city || null,
    totalOrders: 0,
    completedOrders: 0,
    failedOrders: 0,
    activeOrders: 0,
    completionRate: null,
    rejectionRate: null,
    totalEarning: 0,
    shippedUnits: 0,
    avgShipHours: null,
    medianShipHours: null,
    assignedProducts: 0,
    stockedProducts: 0,
    zeroStockProducts: 0,
    totalStock: 0,
    stockFillRate: null,
    score: 0,
  };
}

function computeScore(row) {
  const completion = row.completionRate ?? 0;
  const fill = row.stockFillRate ?? 0;
  const shipPenalty =
    row.avgShipHours == null
      ? 0
      : Math.min(40, Math.max(0, row.avgShipHours - 24) * 0.8);
  const volumeBonus = Math.min(20, row.completedOrders * 1.5);
  return round1(
    completion * 0.45 + fill * 0.35 + volumeBonus - shipPenalty
  );
}

export function buildProducerAnalytics({
  producers = [],
  orders = [],
  orderItems = [],
  producerProducts = [],
}) {
  const byProducer = new Map();

  for (const producer of producers) {
    byProducer.set(producer.id, emptyProducerStats(producer));
  }

  const unitsByOrder = new Map();
  for (const item of orderItems) {
    const qty = Number(item.quantity || 0);
    unitsByOrder.set(
      item.producer_order_id,
      (unitsByOrder.get(item.producer_order_id) || 0) + qty
    );
  }

  const networkShipHours = [];
  let networkCompleted = 0;
  let networkFailed = 0;
  let networkTotal = 0;
  let networkActive = 0;
  let networkEarning = 0;

  for (const order of orders) {
    const row = byProducer.get(order.producer_id);
    if (!row) continue;

    networkTotal += 1;
    row.totalOrders += 1;
    row.totalEarning += Number(order.producer_earning || 0);
    networkEarning += Number(order.producer_earning || 0);

    if (COMPLETED_STATUSES.has(order.status)) {
      row.completedOrders += 1;
      networkCompleted += 1;
      row.shippedUnits += unitsByOrder.get(order.id) || 0;
      const hours = shippingHours(order);
      if (hours != null) {
        if (!row._shipHours) row._shipHours = [];
        row._shipHours.push(hours);
        networkShipHours.push(hours);
      }
    } else if (FAILED_STATUSES.has(order.status)) {
      row.failedOrders += 1;
      networkFailed += 1;
    } else if (ACTIVE_STATUSES.has(order.status)) {
      row.activeOrders += 1;
      networkActive += 1;
    }
  }

  for (const pp of producerProducts) {
    const row = byProducer.get(pp.producer_id);
    if (!row || !pp.is_active) continue;
    row.assignedProducts += 1;
    const qty = Number(pp.stock_quantity || 0);
    row.totalStock += qty;
    if (qty > 0) row.stockedProducts += 1;
    else row.zeroStockProducts += 1;
  }

  const producersList = [];
  for (const row of byProducer.values()) {
    const decided = row.completedOrders + row.failedOrders;
    row.completionRate =
      decided > 0 ? round1((row.completedOrders / decided) * 100) : null;
    row.rejectionRate =
      row.totalOrders > 0
        ? round1((row.failedOrders / row.totalOrders) * 100)
        : null;
    row.avgShipHours = row._shipHours?.length
      ? round1(avg(row._shipHours))
      : null;
    row.medianShipHours = row._shipHours?.length
      ? round1(median(row._shipHours))
      : null;
    row.stockFillRate =
      row.assignedProducts > 0
        ? round1((row.stockedProducts / row.assignedProducts) * 100)
        : null;
    row.totalEarning = round2(row.totalEarning);
    row.score = computeScore(row);
    delete row._shipHours;
    producersList.push(row);
  }

  producersList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.completedOrders !== a.completedOrders) {
      return b.completedOrders - a.completedOrders;
    }
    return String(a.fullName).localeCompare(String(b.fullName), "tr");
  });

  const assignedProducts = producerProducts.filter((p) => p.is_active).length;
  const stockedProducts = producerProducts.filter(
    (p) => p.is_active && Number(p.stock_quantity || 0) > 0
  ).length;
  const totalStock = producerProducts.reduce(
    (sum, p) => sum + (p.is_active ? Number(p.stock_quantity || 0) : 0),
    0
  );
  const decidedNetwork = networkCompleted + networkFailed;

  return {
    summary: {
      producerCount: producers.length,
      activeProducerCount: producers.filter((p) => p.is_active).length,
      totalOrders: networkTotal,
      completedOrders: networkCompleted,
      failedOrders: networkFailed,
      activeOrders: networkActive,
      completionRate:
        decidedNetwork > 0
          ? round1((networkCompleted / decidedNetwork) * 100)
          : null,
      avgShipHours: networkShipHours.length
        ? round1(avg(networkShipHours))
        : null,
      medianShipHours: networkShipHours.length
        ? round1(median(networkShipHours))
        : null,
      totalEarning: round2(networkEarning),
      assignedProducts,
      stockedProducts,
      zeroStockProducts: Math.max(0, assignedProducts - stockedProducts),
      totalStock,
      stockFillRate:
        assignedProducts > 0
          ? round1((stockedProducts / assignedProducts) * 100)
          : null,
    },
    producers: producersList,
    slowestProducers: [...producersList]
      .filter((p) => p.avgShipHours != null)
      .sort((a, b) => b.avgShipHours - a.avgShipHours)
      .slice(0, 5),
    fastestProducers: [...producersList]
      .filter((p) => p.avgShipHours != null && p.completedOrders >= 1)
      .sort((a, b) => a.avgShipHours - b.avgShipHours)
      .slice(0, 5),
    lowStockProducers: [...producersList]
      .filter((p) => p.assignedProducts > 0)
      .sort((a, b) => {
        const fillA = a.stockFillRate ?? 0;
        const fillB = b.stockFillRate ?? 0;
        if (fillA !== fillB) return fillA - fillB;
        return b.zeroStockProducts - a.zeroStockProducts;
      })
      .slice(0, 8),
  };
}

export function formatDurationHours(hours) {
  if (hours == null || Number.isNaN(Number(hours))) return "—";
  const value = Number(hours);
  if (value < 24) return `${round1(value)} saat`;
  const days = value / 24;
  if (days < 7) return `${round1(days)} gün`;
  return `${round1(days / 7)} hafta`;
}

export { DAY_MS, HOUR_MS, COMPLETED_STATUSES };
