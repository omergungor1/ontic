-- Pasiften aktife alınan üreticinin gelir denkliğine girmeden önceki tarihi

alter table public.profiles
  add column if not exists activated_at timestamptz;
