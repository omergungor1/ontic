-- Test hesapları gibi üreticileri oto dağıtımın dışında tutar

alter table public.profiles
  add column if not exists skip_auto_assign boolean not null default false;
