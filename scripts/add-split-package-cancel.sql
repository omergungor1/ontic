-- Bölünen Trendyol paketinin kaynak kaydını içeride iptal etmek için

alter table public.trendyol_orders
  add column if not exists cancel_reason text;

alter table public.trendyol_orders
  add column if not exists replaced_by_package_ids jsonb;

alter table public.trendyol_orders
  add column if not exists origin_package_ids jsonb;

update public.trendyol_orders
set origin_package_ids = raw->'originPackageIds'
where jsonb_typeof(raw->'originPackageIds') = 'array'
  and origin_package_ids is null;

with links as (
  select
    child.order_number,
    child.trendyol_package_id as child_id,
    (jsonb_array_elements(child.raw->'originPackageIds'))::text as origin_id
  from public.trendyol_orders child
  where jsonb_typeof(child.raw->'originPackageIds') = 'array'
),
grouped as (
  select
    origin_id::bigint as origin_id,
    order_number,
    jsonb_agg(distinct child_id) as replaced_by
  from links
  where origin_id ~ '^[0-9]+$'
  group by origin_id, order_number
)
update public.trendyol_orders parent
set
  internal_status = 'cancelled',
  cancel_reason = 'Trendyol gönderi paketi bölündüğü için otomatik iptal edildi.',
  replaced_by_package_ids = grouped.replaced_by,
  updated_at = now()
from grouped
where parent.trendyol_package_id = grouped.origin_id
  and parent.order_number = grouped.order_number
  and parent.internal_status not in ('cancelled', 'completed');

update public.producer_orders producer_order
set
  status = 'cancelled',
  updated_at = now()
from public.trendyol_orders parent
where producer_order.trendyol_order_id = parent.id
  and parent.cancel_reason = 'Trendyol gönderi paketi bölündüğü için otomatik iptal edildi.'
  and parent.internal_status = 'cancelled'
  and producer_order.status in ('created', 'confirmed', 'ready');
