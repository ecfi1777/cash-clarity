-- Create templates table
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  direction text not null check (direction in ('pmt', 'dep')),
  type text not null check (type in ('Check', 'EFT', 'ACH', 'Cash')),
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly')),
  last_generated_date date,
  next_due_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create transactions table
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  direction text not null check (direction in ('pmt', 'dep')),
  type text not null check (type in ('Check', 'EFT', 'ACH', 'Cash')),
  date date not null,
  cleared boolean not null default false,
  cleared_date date,
  is_recurring boolean not null default false,
  template_id uuid references public.templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create bank_balance table (single row)
create table public.bank_balance (
  id uuid primary key default gen_random_uuid(),
  balance numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed with one row
insert into public.bank_balance (balance) values (0);

-- Enable RLS on all tables
alter table public.templates enable row level security;
alter table public.transactions enable row level security;
alter table public.bank_balance enable row level security;

-- Since this is a single-user app with no auth, allow all operations
create policy "Allow all on templates" on public.templates for all using (true) with check (true);
create policy "Allow all on transactions" on public.transactions for all using (true) with check (true);
create policy "Allow all on bank_balance" on public.bank_balance for all using (true) with check (true);

-- Create updated_at trigger function
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add triggers
create trigger templates_updated_at
  before update on public.templates
  for each row execute function public.update_updated_at();

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.update_updated_at();
