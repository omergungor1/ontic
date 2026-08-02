const BASE_URL = "https://apigw.trendyol.com";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ORDER_RANGE_MS = 14 * DAY_MS;

function getConfig() {
  const sellerId = process.env.TRENDYOL_SATICI_ID;
  const apiKey = process.env.TRENDYOL_API_KEY;
  const apiSecret = process.env.TRENDYOL_API_SECRET;
  const token = process.env.TRENDYOL_TOKEN;
  const storeFrontCode = process.env.TRENDYOL_STOREFRONT_CODE || "TR";

  if (!sellerId || (!token && (!apiKey || !apiSecret))) {
    throw new Error(
      "Trendyol env eksik: TRENDYOL_SATICI_ID ve TRENDYOL_TOKEN (veya API_KEY + API_SECRET) gerekli."
    );
  }

  const authorization = token?.startsWith("Basic ")
    ? token
    : `Basic ${token || Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;

  return {
    sellerId,
    storeFrontCode,
    headers: {
      Authorization: authorization,
      "User-Agent": `${sellerId} - SelfIntegration`,
      storeFrontCode,
      Accept: "application/json",
    },
  };
}

async function trendyolFetch(path, searchParams = {}) {
  const { headers } = getConfig();
  const url = new URL(`${BASE_URL}${path}`);

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    url: url.toString(),
    data,
  };
}

function buildDateChunks(startDate, endDate) {
  const chunks = [];
  let cursorEnd = endDate;

  while (cursorEnd > startDate) {
    const cursorStart = Math.max(startDate, cursorEnd - MAX_ORDER_RANGE_MS);
    chunks.push({ startDate: cursorStart, endDate: cursorEnd });
    cursorEnd = cursorStart - 1;
  }

  return chunks;
}

export async function fetchProducts({ page = 0, size = 100, all = true } = {}) {
  const { sellerId } = getConfig();
  const path = `/integration/product/sellers/${sellerId}/products/approved`;

  if (!all) {
    return trendyolFetch(path, { page, size });
  }

  const content = [];
  const urls = [];
  let currentPage = 0;
  let totalElements = 0;
  let totalPages = 1;
  let nextPageToken;
  let lastStatus = 200;
  let lastOk = true;

  while (currentPage < totalPages) {
    const result = await trendyolFetch(path, {
      page: currentPage,
      size,
      ...(nextPageToken ? { nextPageToken } : {}),
    });

    urls.push(result.url);
    lastStatus = result.status;
    lastOk = result.ok;

    if (!result.ok) {
      return {
        ...result,
        urls,
        data: {
          ...result.data,
          content,
          fetchedElements: content.length,
        },
      };
    }

    const pageContent = result.data?.content || [];
    content.push(...pageContent);
    totalElements = result.data?.totalElements ?? content.length;
    totalPages = result.data?.totalPages ?? 1;
    nextPageToken = result.data?.nextPageToken;
    currentPage += 1;

    if (pageContent.length === 0) break;
  }

  return {
    ok: lastOk,
    status: lastStatus,
    url: urls[0],
    urls,
    data: {
      totalElements,
      totalPages,
      page: 0,
      size: content.length,
      fetchedElements: content.length,
      content,
    },
  };
}

async function fetchOrdersInRange({
  startDate,
  endDate,
  size = 200,
  status,
}) {
  const { sellerId } = getConfig();
  const path = `/integration/order/sellers/${sellerId}/orders`;
  const content = [];
  const urls = [];
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;
  let lastStatus = 200;
  let lastOk = true;

  while (page < totalPages) {
    const result = await trendyolFetch(path, {
      page,
      size,
      startDate,
      endDate,
      orderByField: "PackageLastModifiedDate",
      orderByDirection: "DESC",
      ...(status ? { status } : {}),
    });

    urls.push(result.url);
    lastStatus = result.status;
    lastOk = result.ok;

    if (!result.ok) {
      return { ok: false, status: lastStatus, urls, content, error: result.data };
    }

    const pageContent = result.data?.content || [];
    content.push(...pageContent);
    totalElements = result.data?.totalElements ?? content.length;
    totalPages = result.data?.totalPages ?? 1;
    page += 1;

    if (pageContent.length === 0) break;
  }

  return {
    ok: lastOk,
    status: lastStatus,
    urls,
    content,
    totalElements,
  };
}

export async function fetchOrders({
  page = 0,
  size = 200,
  status,
  days = 7,
  all = true,
  startDate: customStart,
  endDate: customEnd,
} = {}) {
  const endDate = customEnd || Date.now();
  const startDate =
    customStart || endDate - Number(days) * DAY_MS;

  if (!all) {
    const { sellerId } = getConfig();
    return trendyolFetch(`/integration/order/sellers/${sellerId}/orders`, {
      page,
      size,
      startDate,
      endDate,
      orderByField: "PackageLastModifiedDate",
      orderByDirection: "DESC",
      ...(status ? { status } : {}),
    });
  }

  const chunks = buildDateChunks(startDate, endDate);
  const content = [];
  const urls = [];
  let lastStatus = 200;
  let lastOk = true;
  let totalElements = 0;

  for (const chunk of chunks) {
    const result = await fetchOrdersInRange({
      startDate: chunk.startDate,
      endDate: chunk.endDate,
      size,
      status,
    });

    urls.push(...result.urls);
    lastStatus = result.status;
    lastOk = result.ok;

    if (!result.ok) {
      return {
        ok: false,
        status: lastStatus,
        url: urls[0],
        urls,
        data: {
          content,
          fetchedElements: content.length,
          startDate,
          endDate,
          days,
          error: result.error,
        },
      };
    }

    content.push(...result.content);
    totalElements += result.totalElements || result.content.length;
  }

  const unique = [];
  const seen = new Set();

  for (const item of content) {
    const key = String(item.id || item.shipmentPackageId || item.orderNumber);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return {
    ok: lastOk,
    status: lastStatus,
    url: urls[0],
    urls,
    data: {
      totalElements: unique.length,
      totalPages: 1,
      page: 0,
      size: unique.length,
      fetchedElements: unique.length,
      startDate,
      endDate,
      days,
      status: status || null,
      content: unique,
    },
  };
}
