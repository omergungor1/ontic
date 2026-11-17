-- Oto dağıtım ayarı, üretici açık sipariş limiti ve admin bildirim zamanı

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all
  on public.app_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, update on table public.app_settings to authenticated;
grant all on table public.app_settings to service_role;

insert into public.app_settings (key, value)
values (
  'auto_assign',
  '{"enabled":false,"start":"09:00","end":"22:00"}'::jsonb
)
on conflict (key) do nothing;

alter table public.profiles
  add column if not exists max_open_orders integer;

alter table public.profiles
  drop constraint if exists profiles_max_open_orders_check;

alter table public.profiles
  add constraint profiles_max_open_orders_check
  check (max_open_orders is null or max_open_orders >= 1);

create or replace function public.protect_profile_max_open_orders()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.max_open_orders is distinct from old.max_open_orders
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Açık sipariş limiti yalnızca admin tarafından değiştirilebilir';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_max_open_orders on public.profiles;

create trigger profiles_protect_max_open_orders
  before update on public.profiles
  for each row
  execute function public.protect_profile_max_open_orders();

alter table public.trendyol_orders
  add column if not exists auto_notified_at timestamptz;
