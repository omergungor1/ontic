-- Tamamlanmış üretici siparişlerinde boş kalan kargolama zamanını doldurur.
-- Geçmiş kayıtlar son güncelleme anını kullanır. Yeni kayıtlarda tetikleyici now() yazar.

create or replace function public.stamp_producer_order_shipped_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('completed', 'shipped') and new.shipped_at is null then
    new.shipped_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists producer_orders_stamp_shipped_at on public.producer_orders;

create trigger producer_orders_stamp_shipped_at
  before insert or update on public.producer_orders
  for each row
  execute function public.stamp_producer_order_shipped_at();

update public.producer_orders
set shipped_at = updated_at
where status in ('completed', 'shipped')
  and shipped_at is null
  and updated_at is not null;
