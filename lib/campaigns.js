/** Kampanya tarih aralığında yalnızca manuel stok delta toplamı */
export async function getManualNetStockAdded(
  admin,
  producerId,
  startsAt,
  endsAt
) {
  const { data, error } = await admin
    .from("stock_change_logs")
    .select("delta")
    .eq("producer_id", producerId)
    .eq("source", "manual")
    .gte("created_at", startsAt)
    .lte("created_at", endsAt);
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + Number(row.delta || 0), 0);
}

/** Üreticinin kampanya döneminde ürün bazlı manuel stok hareketleri */
export async function getProducerCampaignStockBreakdown(
  admin,
  campaign,
  producerId
) {
  const { data: logs, error } = await admin
    .from("stock_change_logs")
    .select(
      "id, product_id, previous_quantity, new_quantity, delta, created_at"
    )
    .eq("producer_id", producerId)
    .eq("source", "manual")
    .gte("created_at", campaign.starts_at)
    .lte("created_at", campaign.ends_at)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = logs || [];
  const netByProduct = new Map();
  for (const row of rows) {
    const key = row.product_id || "__unknown__";
    const prev = netByProduct.get(key) || {
      productId: row.product_id || null,
      netDelta: 0,
      added: 0,
      removed: 0,
      changeCount: 0,
    };
    const delta = Number(row.delta || 0);
    prev.netDelta += delta;
    if (delta > 0) prev.added += delta;
    if (delta < 0) prev.removed += Math.abs(delta);
    prev.changeCount += 1;
    netByProduct.set(key, prev);
  }

  const productIds = [...netByProduct.values()]
    .map((row) => row.productId)
    .filter(Boolean);

  const titleById = new Map();
  if (productIds.length) {
    const { data: products } = await admin
      .from("products")
      .select("id, title, image_url")
      .in("id", productIds);
    for (const product of products || []) {
      titleById.set(product.id, product);
    }
  }

  const products = [...netByProduct.values()]
    .map((row) => {
      const product = row.productId ? titleById.get(row.productId) : null;
      return {
        productId: row.productId,
        title: product?.title || "Bilinmeyen ürün",
        imageUrl: product?.image_url || null,
        netDelta: row.netDelta,
        added: row.added,
        removed: row.removed,
        changeCount: row.changeCount,
      };
    })
    .sort((a, b) => b.netDelta - a.netDelta || b.added - a.added);

  const netTotal = products.reduce((sum, row) => sum + Number(row.netDelta || 0), 0);

  return {
    products,
    logs: rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      title: row.product_id
        ? titleById.get(row.product_id)?.title || "Bilinmeyen ürün"
        : "Bilinmeyen ürün",
      previousQuantity: Number(row.previous_quantity || 0),
      newQuantity: Number(row.new_quantity || 0),
      delta: Number(row.delta || 0),
      createdAt: row.created_at,
    })),
    netTotal,
  };
}

export async function listActiveCampaigns(admin, { at = new Date() } = {}) {
  const nowIso = new Date(at).toISOString();
  const { data, error } = await admin
    .from("stock_campaigns")
    .select("*")
    .eq("is_active", true)
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso)
    .order("ends_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Üreticinin manuel stok ilerlemesine göre claim oluştur/güncelle.
 * Hedefe ulaşınca pending claim açılır; approved/rejected dokunulmaz.
 */
export async function syncProducerCampaignClaims(admin, producerId) {
  if (!producerId) return [];

  const campaigns = await listActiveCampaigns(admin);
  if (!campaigns.length) return [];

  const { data: existingClaims, error: claimsError } = await admin
    .from("stock_campaign_claims")
    .select("*")
    .eq("producer_id", producerId)
    .in(
      "campaign_id",
      campaigns.map((c) => c.id)
    );
  if (claimsError) throw claimsError;

  const claimByCampaign = new Map(
    (existingClaims || []).map((c) => [c.campaign_id, c])
  );
  const results = [];

  for (const campaign of campaigns) {
    const net = await getManualNetStockAdded(
      admin,
      producerId,
      campaign.starts_at,
      campaign.ends_at
    );
    const existing = claimByCampaign.get(campaign.id);

    if (existing) {
      if (existing.status === "pending") {
        const { data: updated, error } = await admin
          .from("stock_campaign_claims")
          .update({
            net_stock_added: net,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        results.push(updated);
      } else {
        results.push(existing);
      }
      continue;
    }

    if (net >= Number(campaign.target_stock || 0)) {
      const { data: created, error } = await admin
        .from("stock_campaign_claims")
        .insert({
          campaign_id: campaign.id,
          producer_id: producerId,
          net_stock_added: net,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) {
        // yarış durumunda unique ihlali — mevcut kaydı al
        if (String(error.code) === "23505") {
          const { data: raced } = await admin
            .from("stock_campaign_claims")
            .select("*")
            .eq("campaign_id", campaign.id)
            .eq("producer_id", producerId)
            .maybeSingle();
          if (raced) results.push(raced);
          continue;
        }
        throw error;
      }
      results.push(created);
    }
  }

  return results;
}

export async function buildProducerCampaignCards(admin, producerId) {
  const campaigns = await listActiveCampaigns(admin);
  if (!campaigns.length) return [];

  const { data: claims } = await admin
    .from("stock_campaign_claims")
    .select("*")
    .eq("producer_id", producerId)
    .in(
      "campaign_id",
      campaigns.map((c) => c.id)
    );
  const claimByCampaign = new Map(
    (claims || []).map((c) => [c.campaign_id, c])
  );

  const cards = [];
  for (const campaign of campaigns) {
    const claim = claimByCampaign.get(campaign.id) || null;
    const net =
      claim && claim.status !== "pending"
        ? Number(claim.net_stock_added || 0)
        : await getManualNetStockAdded(
            admin,
            producerId,
            campaign.starts_at,
            campaign.ends_at
          );

    // pending claim net'i tazele
    let status = claim?.status || null;
    if (!claim && net >= Number(campaign.target_stock || 0)) {
      const synced = await syncProducerCampaignClaims(admin, producerId);
      const fresh = synced.find((c) => c.campaign_id === campaign.id);
      status = fresh?.status || "pending";
    }

    const target = Number(campaign.target_stock || 0);
    const remaining = Math.max(0, target - Math.max(0, net));
    const endsAt = new Date(campaign.ends_at);
    const msLeft = endsAt.getTime() - Date.now();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    cards.push({
      id: campaign.id,
      title: campaign.title || "Stok kampanyası",
      startsAt: campaign.starts_at,
      endsAt: campaign.ends_at,
      targetStock: target,
      rewardAmount: Number(campaign.reward_amount || 0),
      netStockAdded: net,
      remaining,
      daysLeft,
      metTarget: net >= target,
      claimStatus: status,
      claimId: claim?.id || null,
    });
  }

  return cards;
}

export async function listCampaignEligibleProducers(admin, campaign) {
  const { data: logs, error } = await admin
    .from("stock_change_logs")
    .select("producer_id, delta")
    .eq("source", "manual")
    .gte("created_at", campaign.starts_at)
    .lte("created_at", campaign.ends_at);
  if (error) throw error;

  const netByProducer = new Map();
  for (const row of logs || []) {
    const prev = netByProducer.get(row.producer_id) || 0;
    netByProducer.set(row.producer_id, prev + Number(row.delta || 0));
  }

  const target = Number(campaign.target_stock || 0);
  const eligibleIds = [...netByProducer.entries()]
    .filter(([, net]) => net >= target)
    .map(([id]) => id);

  const { data: claims } = await admin
    .from("stock_campaign_claims")
    .select("*")
    .eq("campaign_id", campaign.id);

  const claimByProducer = new Map(
    (claims || []).map((c) => [c.producer_id, c])
  );

  // Hedefe ulaşmış ama claim yoksa pending oluştur
  for (const producerId of eligibleIds) {
    if (!claimByProducer.has(producerId)) {
      const net = netByProducer.get(producerId) || 0;
      const { data: created } = await admin
        .from("stock_campaign_claims")
        .insert({
          campaign_id: campaign.id,
          producer_id: producerId,
          net_stock_added: net,
          status: "pending",
        })
        .select("*")
        .maybeSingle();
      if (created) claimByProducer.set(producerId, created);
    } else {
      const claim = claimByProducer.get(producerId);
      if (claim.status === "pending") {
        const net = netByProducer.get(producerId) || 0;
        if (Number(claim.net_stock_added) !== net) {
          const { data: updated } = await admin
            .from("stock_campaign_claims")
            .update({
              net_stock_added: net,
              updated_at: new Date().toISOString(),
            })
            .eq("id", claim.id)
            .select("*")
            .single();
          if (updated) claimByProducer.set(producerId, updated);
        }
      }
    }
  }

  // Onaylı/reddedilmiş claim'leri de listele (hak eden + işlem görmüş)
  const allProducerIds = new Set([
    ...eligibleIds,
    ...[...claimByProducer.keys()],
  ]);

  if (!allProducerIds.size) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, username, phone")
    .in("id", [...allProducerIds]);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  return [...allProducerIds]
    .map((producerId) => {
      const claim = claimByProducer.get(producerId) || null;
      const net =
        Number(claim?.net_stock_added) ||
        Number(netByProducer.get(producerId) || 0);
      return {
        producerId,
        profile: profileMap.get(producerId) || null,
        netStockAdded: net,
        metTarget: net >= target,
        claim,
      };
    })
    .filter((row) => row.metTarget || row.claim)
    .sort((a, b) => {
      const order = { pending: 0, approved: 1, rejected: 2 };
      const aOrder = order[a.claim?.status] ?? 3;
      const bOrder = order[b.claim?.status] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.netStockAdded - a.netStockAdded;
    });
}

export async function approveCampaignClaim(admin, claimId, reviewerId) {
  const { data: claim, error } = await admin
    .from("stock_campaign_claims")
    .select("*, stock_campaigns(*)")
    .eq("id", claimId)
    .maybeSingle();
  if (error) throw error;
  if (!claim) throw Object.assign(new Error("Kayıt bulunamadı"), { status: 404 });
  if (claim.status === "approved") {
    return { claim, already: true };
  }
  if (claim.status === "rejected") {
    throw Object.assign(new Error("Reddedilmiş kayıt onaylanamaz"), {
      status: 400,
    });
  }

  const campaign = claim.stock_campaigns;
  const title = campaign?.title || "Stok kampanyası";
  const amount = Number(campaign?.reward_amount || 0);

  const { data: payment, error: payError } = await admin
    .from("payments")
    .insert({
      producer_id: claim.producer_id,
      amount,
      note: `Kampanya ödülü: ${title}`,
      kind: "campaign",
      paid_at: new Date().toISOString(),
      created_by: reviewerId || null,
    })
    .select("id")
    .single();
  if (payError) throw payError;

  const { data: updated, error: updateError } = await admin
    .from("stock_campaign_claims")
    .update({
      status: "approved",
      payment_id: payment.id,
      reviewed_by: reviewerId || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", claim.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  return { claim: updated, payment, already: false };
}

export async function rejectCampaignClaim(
  admin,
  claimId,
  reviewerId,
  note = ""
) {
  const { data: claim, error } = await admin
    .from("stock_campaign_claims")
    .select("*")
    .eq("id", claimId)
    .maybeSingle();
  if (error) throw error;
  if (!claim) throw Object.assign(new Error("Kayıt bulunamadı"), { status: 404 });
  if (claim.status === "approved") {
    throw Object.assign(new Error("Onaylı kayıt reddedilemez"), { status: 400 });
  }
  if (claim.status === "rejected") {
    return { claim, already: true };
  }

  const { data: updated, error: updateError } = await admin
    .from("stock_campaign_claims")
    .update({
      status: "rejected",
      note: note || null,
      reviewed_by: reviewerId || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", claim.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return { claim: updated, already: false };
}

export function dayStartIso(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toISOString();
}

export function dayEndIso(dateStr) {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d.toISOString();
}
