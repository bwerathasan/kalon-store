-- ════════════════════════════════════════
-- KALON — Orders table
-- Run this in Supabase → SQL Editor
-- ════════════════════════════════════════

-- Enable UUID extension (already enabled in Supabase by default)
create extension if not exists "uuid-ossp";

-- Create orders table
create table if not exists orders (
  id         uuid primary key default uuid_generate_v4(),
  full_name  text not null,
  phone      text not null,
  email      text,
  city       text not null,
  address    text not null,
  notes      text,
  created_at timestamptz default now()
);

-- Optional: enable Row Level Security
alter table orders enable row level security;

-- Allow only server-side inserts (service role key bypasses RLS)
-- If using anon key, uncomment the policy below:
-- create policy "Allow insert for all" on orders
--   for insert with check (true);
