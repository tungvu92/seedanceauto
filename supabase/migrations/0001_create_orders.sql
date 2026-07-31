create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  plan text not null check (plan in ('free', 'yearly', 'monthly')),
  amount integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'cancelled')),
  sepay_transaction_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_order_code_idx on public.orders (order_code);

alter table public.orders enable row level security;

-- The public/anon key may only insert new orders (used by /api/create-order).
-- No one can read, update, or delete via the public key — only the
-- service_role key (used server-side by the SePay webhook) bypasses RLS.
create policy "Allow public order creation"
  on public.orders
  for insert
  to anon
  with check (true);

grant insert on public.orders to anon;
