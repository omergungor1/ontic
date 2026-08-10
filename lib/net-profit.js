/** Para tutarlarını kuruşa yuvarla */
export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toRate(percent) {
  return Number(percent || 0) / 100;
}

export const DEFAULT_FINANCIAL_SETTINGS = {
  sales_vat_rate: 10,
  commission_vat_rate: 20,
  cargo_price: 88.96,
  cargo_vat_rate: 20,
  platform_service_fee: 10.99,
  platform_service_fee_vat_rate: 20,
  income_tax_rate: 15,
};

/**
 * Sipariş net kâr breakdown.
 * order: trendyol_orders satırı
 * items: trendyol_order_items[]
 * producerOrders: aktif producer_orders[] (iptal/red hariç)
 * settings: store_financial_settings
 */
export function calculateOrderNetProfit({
  order,
  items = [],
  producerOrders = [],
  settings = DEFAULT_FINANCIAL_SETTINGS,
}) {
  const salesVatRate = toRate(settings.sales_vat_rate);
  const commissionVatRate = toRate(settings.commission_vat_rate);
  const cargoVatRate = toRate(settings.cargo_vat_rate);
  const platformFeeVatRate = toRate(settings.platform_service_fee_vat_rate);
  const incomeTaxRate = toRate(settings.income_tax_rate);

  const itemSalesGross = (items || []).reduce(
    (sum, item) => sum + Number(item.line_total || 0),
    0
  );

  // Satış: kalem toplamı yoksa sipariş brüt/toplam alanına düş
  const salesGross = roundMoney(
    itemSalesGross > 0
      ? itemSalesGross
      : Number(order?.total_price || order?.gross_amount || 0)
  );

  const salesNet = roundMoney(salesGross / (1 + salesVatRate));
  const salesVat = roundMoney(salesGross - salesNet);

  // Komisyon: API tutarı öncelikli
  let commission = Number(order?.commission_amount);
  if (!Number.isFinite(commission) || commission <= 0) {
    commission = (items || []).reduce((sum, item) => {
      const line = Number(item.line_total || 0);
      const rate = Number(item.commission_rate || 0) / 100;
      return sum + line * rate;
    }, 0);
  }
  commission = roundMoney(commission);
  const commissionVat = roundMoney(commission * commissionVatRate);

  const cargo = roundMoney(Number(settings.cargo_price || 0));
  const cargoVat = roundMoney(cargo * cargoVatRate);

  const platformFee = roundMoney(Number(settings.platform_service_fee || 0));
  const platformFeeVat = roundMoney(platformFee * platformFeeVatRate);

  const productCost = roundMoney(
    (producerOrders || []).reduce(
      (sum, po) => sum + Number(po.producer_earning || 0),
      0
    )
  );

  const inputVat = roundMoney(commissionVat + cargoVat + platformFeeVat);
  const vatPayable = roundMoney(salesVat - inputVat);

  const profitBeforeIncomeTax = roundMoney(
    salesNet - commission - cargo - platformFee - productCost
  );

  const incomeTax = roundMoney(
    Math.max(0, profitBeforeIncomeTax) * incomeTaxRate
  );

  const netProfit = roundMoney(profitBeforeIncomeTax - incomeTax);

  const itemBreakdowns = (items || []).map((item) => {
    const itemSales = roundMoney(Number(item.line_total || 0));
    const itemSalesNet = roundMoney(itemSales / (1 + salesVatRate));
    const itemCommission = roundMoney(
      Number(order?.commission_amount) > 0 && salesGross > 0
        ? (itemSales / salesGross) * commission
        : itemSales * (Number(item.commission_rate || 0) / 100)
    );
    return {
      itemId: item.id,
      productName: item.product_name || null,
      salesGross: itemSales,
      salesNet: itemSalesNet,
      commission: itemCommission,
    };
  });

  return {
    orderId: order?.id || null,
    orderNumber: order?.order_number || null,
    orderDate: order?.order_date || null,
    trendyolNetAmount: roundMoney(Number(order?.net_amount || 0)),
    salesGross,
    salesNet,
    salesVat,
    commission,
    commissionVat,
    cargo,
    cargoVat,
    platformFee,
    platformFeeVat,
    productCost,
    inputVat,
    vatPayable,
    profitBeforeIncomeTax,
    incomeTax,
    netProfit,
    items: itemBreakdowns,
  };
}

export async function getStoreFinancialSettings(admin) {
  const { data, error } = await admin
    .from("store_financial_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: insertError } = await admin
    .from("store_financial_settings")
    .insert(DEFAULT_FINANCIAL_SETTINGS)
    .select("*")
    .single();
  if (insertError) throw insertError;
  return created;
}

/**
 * Bir veya birden fazla sipariş için net kâr hesaplar.
 */
export async function calculateOrdersNetProfit(admin, orderIds, settings) {
  const ids = [...new Set((orderIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const financialSettings =
    settings || (await getStoreFinancialSettings(admin));

  const { data: orders, error: ordersError } = await admin
    .from("trendyol_orders")
    .select(
      "id, order_number, order_date, gross_amount, total_price, commission_amount, net_amount, internal_status, customer_first_name, customer_last_name"
    )
    .in("id", ids);
  if (ordersError) throw ordersError;

  const { data: items, error: itemsError } = await admin
    .from("trendyol_order_items")
    .select("id, order_id, product_name, line_total, commission_rate, quantity")
    .in("order_id", ids);
  if (itemsError) throw itemsError;

  const { data: producerOrders, error: poError } = await admin
    .from("producer_orders")
    .select("id, trendyol_order_id, producer_earning, status")
    .in("trendyol_order_id", ids)
    .not("status", "in", '("cancelled","rejected")');
  if (poError) throw poError;

  const itemsByOrder = new Map();
  for (const item of items || []) {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  const poByOrder = new Map();
  for (const po of producerOrders || []) {
    const list = poByOrder.get(po.trendyol_order_id) || [];
    list.push(po);
    poByOrder.set(po.trendyol_order_id, list);
  }

  return (orders || []).map((order) =>
    calculateOrderNetProfit({
      order,
      items: itemsByOrder.get(order.id) || [],
      producerOrders: poByOrder.get(order.id) || [],
      settings: financialSettings,
    })
  );
}
