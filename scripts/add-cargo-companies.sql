-- Üreticinin tercih ettiği kargo firması

create table if not exists public.cargo_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cargo_companies drop column if exists group_key;

alter table public.cargo_companies enable row level security;

drop policy if exists cargo_companies_read on public.cargo_companies;
create policy cargo_companies_read
  on public.cargo_companies
  for select
  to authenticated
  using (true);

drop policy if exists cargo_companies_admin_write on public.cargo_companies;
create policy cargo_companies_admin_write
  on public.cargo_companies
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on table public.cargo_companies to authenticated;
grant all on table public.cargo_companies to service_role;

insert into public.cargo_companies (name, code, sort_order)
values
  ('Trendyol Express', 'trendyol-express', 10),
  ('Yurtiçi Kargo', 'yurtici', 20),
  ('Sürat Kargo', 'surat', 30),
  ('DHL eCommerce', 'dhl-ecommerce', 40),
  ('Kolay Gelsin', 'kolay-gelsin', 50),
  ('Aras Kargo', 'aras', 60),
  ('Horoz Kargo', 'horoz', 70),
  ('CEVA Logistics', 'ceva', 80)
on conflict (code) do nothing;

alter table public.profiles
  add column if not exists cargo_company_id uuid references public.cargo_companies(id) on delete set null;
