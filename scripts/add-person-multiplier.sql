-- Üretici hesabını aynı anda kaç kişinin kullandığı. Yalnızca admin görür ve değiştirir.
alter table public.profiles
  add column if not exists person_multiplier integer not null default 1;

alter table public.profiles
  drop constraint if exists profiles_person_multiplier_check;

alter table public.profiles
  add constraint profiles_person_multiplier_check
  check (person_multiplier >= 1);

create or replace function public.protect_profile_person_multiplier()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.person_multiplier is distinct from old.person_multiplier
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Kişi çarpanı yalnızca admin tarafından değiştirilebilir';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_person_multiplier on public.profiles;

create trigger profiles_protect_person_multiplier
  before update on public.profiles
  for each row
  execute function public.protect_profile_person_multiplier();
