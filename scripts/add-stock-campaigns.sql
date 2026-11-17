-- Stok değişim logları + stok kampanyaları
-- (Supabase MCP ile de uygulandı; referans dosya)

create table if not exists public.stock_change_logs (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  producer_product_id uuid references public.producer_products(id) on delete set null,
  previous_quantity numeric not null default 0,
  new_quantity numeric not null default 0,
  delta numeric not null default 0,
  source text not null check (source in ('manual', 'shipment', 'admin')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  target_stock integer not null check (target_stock > 0),
  reward_amount numeric not null check (reward_amount >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.stock_campaign_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.stock_campaigns(id) on delete cascade,
  producer_id uuid not null references public.profiles(id) on delete cascade,
  net_stock_added numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  payment_id uuid references public.payments(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, producer_id)
);

alter table public.payments
  add column if not exists kind text not null default 'manual';

alter table public.producer_orders
  add column if not exists shipped_at timestamptz;

-- stok log kaynakları: manual | shipment | admin | restore
-- alter table public.stock_change_logs drop constraint if exists stock_change_logs_source_check;
-- alter table public.stock_change_logs add constraint stock_change_logs_source_check
--   check (source in ('manual', 'shipment', 'admin', 'restore'));

update public.producer_orders
set shipped_at = coalesce(shipped_at, updated_at, created_at)
where status in ('completed', 'shipped')
  and shipped_at is null;
