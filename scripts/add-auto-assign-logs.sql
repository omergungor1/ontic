-- Oto dağıtım kararlarının kısa açıklaması

create table if not exists public.auto_assign_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trendyol_order_id uuid references public.trendyol_orders(id) on delete set null,
  producer_order_id uuid references public.producer_orders(id) on delete set null,
  producer_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail text not null
);

create index if not exists auto_assign_logs_created_at_idx
  on public.auto_assign_logs (created_at desc);

alter table public.auto_assign_logs enable row level security;

drop policy if exists auto_assign_logs_admin_select on public.auto_assign_logs;
create policy auto_assign_logs_admin_select
  on public.auto_assign_logs
  for select
  using (public.is_admin());

grant select on table public.auto_assign_logs to authenticated;
grant all on table public.auto_assign_logs to service_role;
