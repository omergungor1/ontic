-- Üretici siparişine seçilen kargo firması

alter table public.producer_orders
  add column if not exists cargo_company_id uuid
  references public.cargo_companies(id) on delete set null;
