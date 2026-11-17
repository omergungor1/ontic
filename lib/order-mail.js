import { normalizeMailAddress, sendProducerNewOrderMail } from "@/lib/mail";

export async function notifyAssignedProducers(
  admin,
  { orderId, assignments, itemMap }
) {
  const result = { sent: 0, skipped: 0, failed: 0 };
  const groups = (assignments || [])
    .map((assignment) => ({
      producerId: assignment.producerId,
      items: (assignment.items || [])
        .filter((item) => Number(item.quantity) > 0)
        .map((item) => {
          const orderItem = itemMap.get(item.orderItemId);
          return {
            title: orderItem?.product_name || "Ürün",
            quantity: Number(item.quantity),
          };
        }),
    }))
    .filter((group) => group.producerId && group.items.length);

  if (!groups.length) return result;

  const producerIds = [...new Set(groups.map((group) => group.producerId))];
  const [{ data: profiles }, { data: order }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", producerIds),
    admin
      .from("trendyol_orders")
      .select("order_number")
      .eq("id", orderId)
      .maybeSingle(),
  ]);

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  for (const group of groups) {
    const profile = profileById.get(group.producerId);
    const email = normalizeMailAddress(profile?.email);
    if (!email) {
      result.skipped += 1;
      continue;
    }

    try {
      await sendProducerNewOrderMail({
        to: email,
        producerName: profile?.full_name,
        orderNumber: order?.order_number || "",
        items: group.items,
      });
      result.sent += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
