alter table public.products
  add column if not exists material_support numeric not null default 0;

alter table public.producer_order_items
  add column if not exists unit_material_support numeric not null default 0;

alter table public.producer_orders
  add column if not exists material_support numeric not null default 0;
