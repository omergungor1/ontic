-- Son Trendyol sipariş senkronunun zamanı

create table if not exists public.app_state (
  key text primary key,
  value timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists app_state_admin_select on public.app_state;
create policy app_state_admin_select
  on public.app_state
  for select
  using (public.is_admin());

grant select on table public.app_state to authenticated;
grant all on table public.app_state to service_role;

insert into public.app_state (key, value)
values ('orders_synced_at', now())
on conflict (key) do nothing;
