-- Yıldızlı ürün ve üretici stok bonus defteri

alter table public.products
  add column if not exists is_starred boolean not null default false;

alter table public.products
  add column if not exists star_bonus numeric not null default 0;

alter table public.products
  drop constraint if exists products_star_bonus_check;

alter table public.products
  add constraint products_star_bonus_check
  check (star_bonus >= 0);

create table if not exists public.star_bonus_lots (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  producer_product_id uuid references public.producer_products(id) on delete set null,
  unit_bonus numeric not null check (unit_bonus >= 0),
  quantity integer not null check (quantity > 0),
  open_quantity integer not null default 0 check (open_quantity >= 0),
  locked_quantity integer not null default 0 check (locked_quantity >= 0),
  clawed_quantity integer not null default 0 check (clawed_quantity >= 0),
  created_at timestamptz not null default now(),
  check (open_quantity + locked_quantity + clawed_quantity = quantity)
);

create index if not exists star_bonus_lots_producer_product_idx
  on public.star_bonus_lots (producer_id, product_id, created_at);

create table if not exists public.star_bonus_entries (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  producer_product_id uuid references public.producer_products(id) on delete set null,
  stock_change_log_id uuid references public.stock_change_logs(id) on delete set null,
  entry_type text not null check (entry_type in ('credit', 'clawback')),
  quantity integer not null check (quantity > 0),
  unit_bonus numeric not null default 0,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists star_bonus_entries_producer_created_idx
  on public.star_bonus_entries (producer_id, created_at desc);

alter table public.star_bonus_lots enable row level security;
alter table public.star_bonus_entries enable row level security;

drop policy if exists star_bonus_lots_admin_all on public.star_bonus_lots;
create policy star_bonus_lots_admin_all
  on public.star_bonus_lots
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists star_bonus_entries_admin_all on public.star_bonus_entries;
create policy star_bonus_entries_admin_all
  on public.star_bonus_entries
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists star_bonus_entries_producer_select on public.star_bonus_entries;
create policy star_bonus_entries_producer_select
  on public.star_bonus_entries
  for select
  using (producer_id = auth.uid());

grant select on table public.star_bonus_entries to authenticated;
grant all on table public.star_bonus_entries to service_role;
grant all on table public.star_bonus_lots to service_role;
